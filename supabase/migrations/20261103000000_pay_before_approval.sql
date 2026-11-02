-- =====================================================================
-- Pay before approval, and payments received directly
-- Run this AFTER 20261102000000_approval_and_payments.sql
-- (SQL Editor > New query > paste this whole file > Run).
-- Safe to run again if a first run stopped partway.
--
--  * Pending registrants see the payment details and can send a payment
--    straight after registering. Declined registrants still cannot.
--  * Confirming a payment also approves the registration.
--  * Admins can record a payment they received directly (cash, a transfer
--    to them): it is kept as a Paid payment with no receipt.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Who may pay: a signed-in registrant who is pending or approved
-- ---------------------------------------------------------------------
create or replace function public.can_pay()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attendees a
    where a.user_id = auth.uid() and a.registration_status in ('pending', 'approved')
  );
$$;

revoke all on function public.can_pay() from public, anon;
grant execute on function public.can_pay() to authenticated, service_role;

drop policy if exists "Approved registrants and admins can read payment settings" on public.payment_settings;
drop policy if exists "Registrants and admins can read payment settings" on public.payment_settings;
create policy "Registrants and admins can read payment settings"
  on public.payment_settings for select to authenticated
  using ((select public.is_admin()) or (select public.can_pay()));

-- ---------------------------------------------------------------------
-- 2. Payments received directly: no receipt, method 'direct'
-- ---------------------------------------------------------------------
alter table public.payment_submissions
  alter column receipt_path drop not null,
  add column if not exists method text not null default 'online' check (method in ('online', 'direct'));
alter table public.payment_submissions drop constraint if exists payment_submissions_receipt_check;
alter table public.payment_submissions
  add constraint payment_submissions_receipt_check check (method = 'direct' or receipt_path is not null);

comment on table public.payment_submissions is
  'Payments: reference numbers and receipts sent by registrants (online), or payments an admin received directly (direct), with the admin decision.';

-- ---------------------------------------------------------------------
-- 3. submit_payment(): pending or approved registrants may pay
-- ---------------------------------------------------------------------
create or replace function public.submit_payment(p_reference text, p_receipt_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_reference text := btrim(coalesce(p_reference, ''));
  v_row       public.attendees%rowtype;
  v_amount    numeric(10, 2);
  v_id        uuid;
begin
  if v_uid is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'P0001';
  end if;

  select * into v_row from public.attendees a where a.user_id = v_uid for update;
  if not found or v_row.registration_status not in ('pending', 'approved') then
    raise exception 'CANNOT_PAY' using errcode = 'P0001';
  end if;
  if v_row.payment_status = 'paid' then
    raise exception 'ALREADY_PAID' using errcode = 'P0001';
  end if;
  if v_row.payment_status = 'submitted' then
    raise exception 'ALREADY_SUBMITTED' using errcode = 'P0001';
  end if;

  select s.amount into v_amount from public.payment_settings s where s.id = 1;
  if v_amount is null then
    raise exception 'PAYMENT_NOT_READY' using errcode = 'P0001';
  end if;

  if char_length(v_reference) not between 4 and 64 or v_reference !~ '^[A-Za-z0-9][A-Za-z0-9 /#.-]*$' then
    raise exception 'INVALID_REFERENCE' using errcode = 'P0001';
  end if;

  if coalesce(p_receipt_path, '') not like v_uid::text || '/%' or not exists (
    select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = p_receipt_path
  ) then
    raise exception 'RECEIPT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payment_submissions p where p.receipt_path = p_receipt_path) then
    raise exception 'RECEIPT_ALREADY_USED' using errcode = 'P0001';
  end if;

  insert into public.payment_submissions (attendee_id, reference, receipt_path, amount)
  values (v_row.id, v_reference, p_receipt_path, v_amount)
  returning id into v_id;

  update public.attendees a set payment_status = 'submitted' where a.id = v_row.id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. review_payment(): confirming a payment also approves the registration
-- ---------------------------------------------------------------------
create or replace function public.review_payment(p_submission_id uuid, p_decision text, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin  text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_sub    public.payment_submissions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = 'P0001';
  end if;
  if p_decision not in ('paid', 'rejected') then
    raise exception 'INVALID_DECISION' using errcode = 'P0001';
  end if;
  if p_decision = 'rejected' and v_reason is null then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select lower(u.email) into v_admin from auth.users u where u.id = auth.uid();

  select * into v_sub from public.payment_submissions p where p.id = p_submission_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_sub.status <> 'submitted' then
    raise exception 'ALREADY_REVIEWED' using errcode = 'P0001';
  end if;

  update public.payment_submissions p set
    status        = p_decision,
    reject_reason = case when p_decision = 'rejected' then left(v_reason, 500) end,
    reviewed_at   = now(),
    reviewed_by   = v_admin
  where p.id = v_sub.id;

  update public.attendees a set
    payment_status      = p_decision::public.payment_status,
    registration_status = case when p_decision = 'paid' then 'approved'::public.registration_status else a.registration_status end,
    reviewed_by         = v_admin
  where a.id = v_sub.attendee_id;

  return v_sub.attendee_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. record_direct_payment(): an admin marks someone Paid who paid them
--    directly. The payment is kept with the note as its reference, the
--    current amount, and who recorded it; the registration is approved.
-- ---------------------------------------------------------------------
create or replace function public.record_direct_payment(p_attendee_id uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin  text;
  v_note   text := left(nullif(btrim(coalesce(p_note, '')), ''), 100);
  v_row    public.attendees%rowtype;
  v_amount numeric(10, 2);
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = 'P0001';
  end if;

  select lower(u.email) into v_admin from auth.users u where u.id = auth.uid();

  select * into v_row from public.attendees a where a.id = p_attendee_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_row.registration_status = 'invited' then
    raise exception 'NOT_REGISTERED' using errcode = 'P0001';
  end if;
  if v_row.payment_status = 'paid' then
    raise exception 'ALREADY_PAID' using errcode = 'P0001';
  end if;
  -- A receipt waiting for review is confirmed on the Payments page instead
  if exists (select 1 from public.payment_submissions p where p.attendee_id = v_row.id and p.status = 'submitted') then
    raise exception 'PAYMENT_WAITING' using errcode = 'P0001';
  end if;

  -- A Paid record can already exist if the status was changed by hand
  if not exists (select 1 from public.payment_submissions p where p.attendee_id = v_row.id and p.status = 'paid') then
    select s.amount into v_amount from public.payment_settings s where s.id = 1;
    insert into public.payment_submissions
      (attendee_id, reference, receipt_path, amount, status, method, reviewed_at, reviewed_by)
    values
      (v_row.id, coalesce(v_note, 'Paid directly'), null, v_amount, 'paid', 'direct', now(), v_admin);
  end if;

  update public.attendees a set
    payment_status      = 'paid',
    registration_status = 'approved',
    reviewed_by         = v_admin
  where a.id = v_row.id;

  return v_row.id;
end;
$$;

revoke all on function public.record_direct_payment(uuid, text) from public, anon;
grant execute on function public.record_direct_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. dashboard_stats(): pending registrants can owe or send a payment too
-- ---------------------------------------------------------------------
create or replace function public.dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'registered', count(*) filter (where a.registration_status <> 'invited'),
    'pending',    count(*) filter (where a.registration_status = 'pending'),
    'approved',   count(*) filter (where a.registration_status = 'approved'),
    'declined',   count(*) filter (where a.registration_status = 'declined'),
    'submitted',  count(*) filter (where a.registration_status in ('pending', 'approved') and a.payment_status = 'submitted'),
    'paid',       count(*) filter (where a.payment_status = 'paid'),
    'unpaid',     count(*) filter (where a.registration_status in ('pending', 'approved') and a.payment_status in ('unpaid', 'rejected')),
    'invited',    count(*) filter (where a.registration_status = 'invited')
  ) into v
  from public.attendees a;

  return v || jsonb_build_object(
    'collected', coalesce((select sum(p.amount) from public.payment_submissions p where p.status = 'paid'), 0),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'count', d.n) order by d.day)
      from (
        select (a.registered_at at time zone 'Asia/Manila')::date as day, count(*) as n
        from public.attendees a
        where a.registration_status <> 'invited' and a.registered_at is not null
        group by 1
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Make the new function visible to the website straight away
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';
