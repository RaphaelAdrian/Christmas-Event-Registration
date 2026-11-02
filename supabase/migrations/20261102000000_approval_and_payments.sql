-- =====================================================================
-- Approval and payment flow
-- Run this AFTER 20261016000000_initial_schema.sql and
-- 20261017000000_name_invite_list.sql
-- (SQL Editor > New query > paste this whole file > Run).
--
--  * Registration and payment get their own statuses:
--      registration: invited / pending / approved / declined
--      payment:      unpaid / submitted / paid / rejected
--  * People register with first name, last name, email and company.
--    The invite-list name matching is unchanged.
--  * An admin approves or declines. Approved people get a login
--    (Supabase Auth invite) and pay from their own page. Every payment
--    attempt is kept in payment_submissions.
--  * Event details, additional details, payment settings and the
--    gallery live in tables that admins edit from /admin.
--
-- Existing rows are kept:
--   Invited   -> Invited
--   Confirmed -> Pending  (their receipt becomes a Payment Submitted)
--   Paid      -> Approved + Paid
--   Cancelled -> Declined
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New statuses
-- ---------------------------------------------------------------------
create type public.registration_status as enum ('invited', 'pending', 'approved', 'declined');
create type public.payment_status as enum ('unpaid', 'submitted', 'paid', 'rejected');

-- The old trigger knows the old statuses; a new one is created below
drop trigger if exists attendees_before_write on public.attendees;

alter table public.attendees
  add column payment_status public.payment_status not null default 'unpaid',
  add column user_id        uuid unique references auth.users (id) on delete set null,
  add column approved_at    timestamptz,
  add column reviewed_by    text check (char_length(reviewed_by) <= 254);

alter table public.attendees rename column cancelled_at to declined_at;

-- ---------------------------------------------------------------------
-- 2. Payment submissions: one row per attempt (resubmissions keep history)
-- ---------------------------------------------------------------------
create table public.payment_submissions (
  id            uuid primary key default gen_random_uuid(),
  attendee_id   uuid not null references public.attendees (id) on delete cascade,
  reference     text not null check (char_length(reference) between 1 and 100),
  -- "1234 5678-90" and "1234567890" are the same reference
  reference_key text generated always as (upper(regexp_replace(reference, '[^A-Za-z0-9]', '', 'g'))) stored,
  receipt_path  text not null unique check (char_length(receipt_path) <= 300),
  amount        numeric(10, 2) check (amount >= 0),
  status        text not null default 'submitted' check (status in ('submitted', 'paid', 'rejected')),
  reject_reason text check (char_length(reject_reason) <= 500),
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   text check (char_length(reviewed_by) <= 254)
);

create index payment_submissions_attendee_idx on public.payment_submissions (attendee_id, submitted_at desc);
create index payment_submissions_reference_key_idx on public.payment_submissions (reference_key);
create index payment_submissions_status_idx on public.payment_submissions (status, submitted_at);
-- At most one payment waiting for review, and one paid, per person
create unique index payment_submissions_one_open_idx on public.payment_submissions (attendee_id) where status = 'submitted';
create unique index payment_submissions_one_paid_idx on public.payment_submissions (attendee_id) where status = 'paid';

comment on table public.payment_submissions is 'Payment reference numbers and receipts sent by approved registrants, with the admin decision.';

-- Move receipts sent during the old one-step registration
insert into public.payment_submissions (attendee_id, reference, receipt_path, status, submitted_at, reviewed_at)
select a.id,
       btrim(a.payment_reference),
       a.receipt_path,
       case when a.status::text = 'paid' then 'paid' else 'submitted' end,
       coalesce(a.registered_at, a.created_at),
       case when a.status::text = 'paid' then a.paid_at end
from public.attendees a
where a.status::text in ('confirmed', 'paid')
  and coalesce(btrim(a.payment_reference), '') <> ''
  and a.receipt_path is not null;

update public.attendees a
set payment_status = case
  when a.status::text = 'paid' then 'paid'::public.payment_status
  when exists (select 1 from public.payment_submissions p where p.attendee_id = a.id) then 'submitted'::public.payment_status
  else 'unpaid'::public.payment_status
end;

-- ---------------------------------------------------------------------
-- 3. The old single status becomes the registration status
-- ---------------------------------------------------------------------
alter table public.attendees alter column status drop default;
alter table public.attendees
  alter column status type public.registration_status using (
    case status::text
      when 'invited'   then 'invited'
      when 'confirmed' then 'pending'
      when 'paid'      then 'approved'
      else                  'declined'
    end
  )::public.registration_status;
alter table public.attendees rename column status to registration_status;
alter table public.attendees alter column registration_status set default 'invited';
alter index public.attendees_status_idx rename to attendees_registration_status_idx;
create index attendees_payment_status_idx on public.attendees (payment_status);

update public.attendees
set approved_at = coalesce(paid_at, registered_at, now())
where registration_status = 'approved';

alter table public.attendees
  drop column payment_reference,
  drop column receipt_path;

-- The old functions use the old status; they are replaced below
drop function if exists public.register_attendee(text, text, text, text, text, text, text, text, text, boolean);
drop type public.attendee_status;

comment on table public.attendees is
  'Invite list and registrants. Admins read and change every row; a signed-in registrant reads only their own.';

-- ---------------------------------------------------------------------
-- 4. Keep email lower-case and stamp the status dates automatically
-- ---------------------------------------------------------------------
create or replace function public.attendees_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  new.updated_at := now();

  if tg_op = 'INSERT' then
    if new.registration_status = 'invited' then
      new.invited_at := coalesce(new.invited_at, now());
    else
      new.registered_at := coalesce(new.registered_at, now());
    end if;
    if new.registration_status = 'approved' then
      new.approved_at := coalesce(new.approved_at, now());
    end if;
    if new.registration_status = 'declined' then
      new.declined_at := coalesce(new.declined_at, now());
    end if;
    if new.payment_status = 'paid' then
      new.paid_at := coalesce(new.paid_at, now());
    end if;
    return new;
  end if;

  if new.registration_status is distinct from old.registration_status then
    if new.registration_status <> 'invited' then
      new.registered_at := coalesce(new.registered_at, now());
    end if;
    new.approved_at := case when new.registration_status = 'approved' then now() end;
    new.declined_at := case when new.registration_status = 'declined' then now() end;
  end if;

  if new.payment_status is distinct from old.payment_status then
    new.paid_at := case when new.payment_status = 'paid' then now() end;
  end if;

  return new;
end;
$$;

create trigger attendees_before_write
before insert or update on public.attendees
for each row execute function public.attendees_before_write();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Event details (one row), additional details, payment settings
--    (one row) and the gallery
-- ---------------------------------------------------------------------
create table public.event_settings (
  id                smallint primary key default 1 check (id = 1),
  name              text not null check (char_length(btrim(name)) between 1 and 120),
  short_name        text not null check (char_length(btrim(short_name)) between 1 and 60),
  tagline           text not null default '' check (char_length(tagline) <= 300),
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  venue_name        text not null default '' check (char_length(venue_name) <= 150),
  venue_address     text not null default '' check (char_length(venue_address) <= 300),
  map_url           text not null default '' check (map_url = '' or (map_url ~ '^https://' and char_length(map_url) <= 1000)),
  call_time         text not null default '' check (char_length(call_time) <= 60),
  shuttle_info      text not null default '' check (char_length(shuttle_info) <= 500),
  organizer         text not null default '' check (char_length(organizer) <= 150),
  contact_email     text not null default '' check (contact_email = '' or contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  registration_open boolean not null default true,
  invite_only       boolean not null default true,
  reference_prefix  text not null default 'EMC' check (reference_prefix ~ '^[A-Z0-9]{1,10}$'),
  terms             text not null default '' check (char_length(terms) <= 10000),
  privacy_notice    text not null default '' check (char_length(privacy_notice) <= 10000),
  updated_at        timestamptz not null default now(),
  updated_by        text,
  constraint event_settings_dates_check check (ends_at > starts_at)
);

comment on table public.event_settings is 'The event details shown on the website (one row). Admins edit it in /admin/event.';

create table public.event_details (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  body       text not null default '' check (char_length(body) <= 3000),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_details_position_idx on public.event_details (position, created_at);

comment on table public.event_details is 'Additional details (title and text) shown on the home page, in order.';

create table public.payment_settings (
  id           smallint primary key default 1 check (id = 1),
  amount       numeric(10, 2) check (amount > 0),
  instructions text not null default '' check (char_length(instructions) <= 3000),
  qr_path      text check (char_length(qr_path) <= 300),
  updated_at   timestamptz not null default now(),
  updated_by   text
);

comment on table public.payment_settings is 'Amount, instructions and QR image (one row). Only approved registrants and admins can read it.';

create table public.gallery_photos (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null unique check (char_length(storage_path) <= 300),
  caption      text not null default '' check (char_length(caption) <= 200),
  width        integer check (width > 0),
  height       integer check (height > 0),
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

create index gallery_photos_position_idx on public.gallery_photos (position, created_at);

comment on table public.gallery_photos is 'Venue photos in the public gallery bucket, in order.';

create trigger event_settings_touch before update on public.event_settings
for each row execute function public.touch_updated_at();
create trigger event_details_touch before update on public.event_details
for each row execute function public.touch_updated_at();
create trigger payment_settings_touch before update on public.payment_settings
for each row execute function public.touch_updated_at();

insert into public.event_settings (
  name, short_name, tagline, starts_at, ends_at, venue_name, venue_address, map_url,
  call_time, shuttle_info, reference_prefix, terms, privacy_notice
) values (
  'EMC-Christmas-Party Fest! 2026',
  'EMC Christmas Party',
  'Our year-end celebration at San Roque''s Peak Resort.',
  '2026-12-12 15:00:00+08',
  '2026-12-13 00:00:00+08',
  'San Roque''s Peak Resort',
  '',
  'https://www.google.com/maps/search/?api=1&query=San+Roque%27s+Peak+Resort',
  '1:00 PM',
  'Free shuttle from KFC Tikling, near SM Taytay. Be there by the call time; the shuttle leaves for the resort from there.',
  'EMC',
  E'Your registration is confirmed only after an organiser approves it and your payment is marked Paid.\n\n'
  'Photos and videos may be taken during the event and shared with attendees. Tell an organiser if you prefer not to be photographed.\n\n'
  'The organisers may update the event details. Any change is posted on this website.',
  E'We collect your name, email address, company, payment reference number and payment receipt to register you for this event, check your payment and send you updates about it.\n\n'
  'Only the event organisers can see this information. It is stored securely and is not shared with anyone else except where the law requires it.\n\n'
  'We keep registration records for up to one year after the event, then delete them.\n\n'
  'Under the Data Privacy Act of 2012 you can ask to see, correct or delete your personal data, or withdraw your consent, by writing to the organisers.'
) on conflict (id) do nothing;

insert into public.payment_settings (instructions) values (
  E'Scan the QR code with your e-wallet or banking app and pay the exact amount shown.\n\n'
  'Then enter the reference number from your receipt and upload a screenshot of it below. We check every payment by hand and email you once it is confirmed.'
) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 6. Helpers
-- ---------------------------------------------------------------------

-- True when the signed-in person has an approved registration
create or replace function public.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attendees a
    where a.user_id = auth.uid() and a.registration_status = 'approved'
  );
$$;

-- The login that belongs to an email, if there is one (server only)
create or replace function public.auth_user_id(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = lower(btrim(coalesce(p_email, ''))) limit 1;
$$;

-- When each registrant last signed in, so admins can tell who has used their invite
create or replace function public.registrant_logins()
returns table (attendee_id uuid, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = 'P0001';
  end if;
  return query
    select a.id, u.last_sign_in_at
    from public.attendees a
    join auth.users u on u.id = a.user_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. resolve_registrant(): same name matching as before. A declined
--    registration is reported as DECLINED (it used to be CANCELLED).
-- ---------------------------------------------------------------------
create or replace function public.resolve_registrant(
  p_first_name  text,
  p_last_name   text,
  p_email       text,
  p_invite_only boolean
)
returns table (outcome text, attendee_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_last   text := public.last_name_key(p_last_name);
  v_id     uuid;
  v_status public.registration_status;
  v_top    integer;
  v_count  integer;
begin
  if v_last = '' or public.name_key(p_first_name) = '' then
    return query select 'NAME_REQUIRED'::text, null::uuid;
    return;
  end if;

  -- An email already on file wins (e.g. someone using their invite link)
  if v_email <> '' then
    select a.id, a.registration_status into v_id, v_status from public.attendees a where a.email = v_email;
    if found then
      if v_status = 'invited' then
        return query select 'INVITED'::text, v_id;
      else
        return query select 'DUPLICATE_EMAIL'::text, v_id;
      end if;
      return;
    end if;
  end if;

  -- Otherwise match the name against everyone on the invite list:
  -- same last name, best-scoring first name wins
  with scored as (
    select public.first_name_score(p_first_name, a.first_name) as score
    from public.attendees a
    where a.invited_at is not null
      and public.last_name_key(a.last_name) = v_last
  )
  select max(s.score), count(*) filter (where s.score = (select max(score) from scored))
  into v_top, v_count
  from scored s;

  if coalesce(v_top, 0) = 0 then
    return query select (case when p_invite_only then 'NOT_INVITED' else 'NEW' end)::text, null::uuid;
    return;
  end if;

  if v_count > 1 then
    return query select 'AMBIGUOUS_NAME'::text, null::uuid;
    return;
  end if;

  select a.id, a.registration_status into v_id, v_status
  from public.attendees a
  where a.invited_at is not null
    and public.last_name_key(a.last_name) = v_last
    and public.first_name_score(p_first_name, a.first_name) = v_top;

  return query select
    (case v_status
       when 'invited' then 'INVITED'
       when 'declined' then 'DECLINED'
       else 'ALREADY_REGISTERED'
     end)::text,
    v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. register_attendee(): first name, last name, email and company.
--    Same invite-list matching; the registration starts as Pending.
--    Reads "registration open", "invite only" and the reference prefix
--    from event_settings.
-- ---------------------------------------------------------------------
create or replace function public.register_attendee(
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_company    text
)
returns table (reference_code text, was_invited boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_email       text := lower(btrim(coalesce(p_email, '')));
  v_first       text := btrim(coalesce(p_first_name, ''));
  v_last        text := btrim(coalesce(p_last_name, ''));
  v_company     text := btrim(coalesce(p_company, ''));
  v_open        boolean;
  v_invite_only boolean;
  v_prefix      text;
  v_now         timestamptz := now();
  v_outcome     text;
  v_id          uuid;
  v_row         public.attendees%rowtype;
  v_code        text;
begin
  select s.registration_open, s.invite_only, s.reference_prefix
  into v_open, v_invite_only, v_prefix
  from public.event_settings s where s.id = 1;

  if not coalesce(v_open, false) then
    raise exception 'REGISTRATION_CLOSED' using errcode = 'P0001';
  end if;
  v_invite_only := coalesce(v_invite_only, true);
  v_prefix := coalesce(v_prefix, 'EMC');

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;
  if v_first = '' or v_last = '' then
    raise exception 'NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(v_company) not between 2 and 150 then
    raise exception 'COMPANY_REQUIRED' using errcode = 'P0001';
  end if;

  -- One registration at a time, so two people can't claim the same invite
  perform pg_advisory_xact_lock(hashtext('public.register_attendee'));

  select r.outcome, r.attendee_id into v_outcome, v_id
  from public.resolve_registrant(v_first, v_last, v_email, v_invite_only) r;

  if v_outcome = 'INVITED' then
    select * into v_row from public.attendees a where a.id = v_id for update;
    if v_row.registration_status <> 'invited' then
      raise exception 'ALREADY_REGISTERED' using errcode = 'P0001';
    end if;

    v_code := coalesce(v_row.reference_code,
                       v_prefix || '-' || lpad(nextval('public.attendee_ref_seq')::text, 4, '0'));
    begin
      update public.attendees a set
        email               = v_email,
        first_name          = case when a.first_name = '' then v_first else a.first_name end,
        last_name           = case when a.last_name = '' then v_last else a.last_name end,
        name_as_entered     = v_first || ' ' || v_last,
        company             = v_company,
        reference_code      = v_code,
        registration_status = 'pending',
        payment_status      = 'unpaid',
        registered_at       = v_now,
        terms_accepted_at   = v_now,
        privacy_consent_at  = v_now
      where a.id = v_row.id;
    exception when unique_violation then
      raise exception 'DUPLICATE_EMAIL' using errcode = 'P0001';
    end;

    return query select v_code, true;
    return;
  end if;

  if v_outcome = 'NEW' then
    v_code := v_prefix || '-' || lpad(nextval('public.attendee_ref_seq')::text, 4, '0');
    begin
      insert into public.attendees (
        first_name, last_name, name_as_entered, email, company, reference_code,
        registration_status, payment_status, registered_at, terms_accepted_at, privacy_consent_at
      ) values (
        v_first, v_last, v_first || ' ' || v_last, v_email, v_company, v_code,
        'pending', 'unpaid', v_now, v_now, v_now
      );
    exception when unique_violation then
      raise exception 'DUPLICATE_EMAIL' using errcode = 'P0001';
    end;
    return query select v_code, false;
    return;
  end if;

  -- NOT_INVITED, ALREADY_REGISTERED, DECLINED, AMBIGUOUS_NAME, DUPLICATE_EMAIL ...
  raise exception '%', v_outcome using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------
-- 9. submit_payment(): an approved, signed-in registrant sends their
--    reference number and receipt. The receipt must already be in their
--    own folder of the private receipts bucket.
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
  if not found or v_row.registration_status <> 'approved' then
    raise exception 'NOT_APPROVED' using errcode = 'P0001';
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
-- 10. review_payment(): an admin marks a submitted payment Paid, or
--     Rejects it with a reason the registrant can see.
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
    payment_status = p_decision::public.payment_status,
    reviewed_by    = v_admin
  where a.id = v_sub.attendee_id;

  return v_sub.attendee_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. dashboard_stats(): the numbers on the admin dashboard
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
    'submitted',  count(*) filter (where a.registration_status = 'approved' and a.payment_status = 'submitted'),
    'paid',       count(*) filter (where a.payment_status = 'paid'),
    'unpaid',     count(*) filter (where a.registration_status = 'approved' and a.payment_status in ('unpaid', 'rejected')),
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
-- 12. Row Level Security
-- ---------------------------------------------------------------------
alter table public.payment_submissions enable row level security;
alter table public.event_settings      enable row level security;
alter table public.event_details       enable row level security;
alter table public.payment_settings    enable row level security;
alter table public.gallery_photos      enable row level security;

-- Logged-out visitors: read the event details and the gallery, nothing else
revoke all on table public.payment_submissions, public.payment_settings from anon;
revoke insert, update, delete, truncate on table public.event_settings, public.event_details, public.gallery_photos from anon;
grant select on table public.event_settings, public.event_details, public.gallery_photos to anon, authenticated;
-- Payments are written only through submit_payment() and review_payment()
revoke insert, update, delete, truncate on table public.payment_submissions from authenticated;
revoke truncate on table public.event_settings, public.event_details, public.payment_settings, public.gallery_photos from authenticated;

-- A signed-in registrant reads their own registration (admins already read all)
create policy "Registrants can read their own registration"
  on public.attendees for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Admins can read payments"
  on public.payment_submissions for select to authenticated
  using ((select public.is_admin()));

create policy "Registrants can read their own payments"
  on public.payment_submissions for select to authenticated
  using (exists (
    select 1 from public.attendees a
    where a.id = payment_submissions.attendee_id and a.user_id = (select auth.uid())
  ));

create policy "Anyone can read the event details"
  on public.event_settings for select to anon, authenticated
  using (true);
create policy "Admins can add event details"
  on public.event_settings for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins can change event details"
  on public.event_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Anyone can read the additional details"
  on public.event_details for select to anon, authenticated
  using (true);
create policy "Admins can add additional details"
  on public.event_details for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins can change additional details"
  on public.event_details for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admins can delete additional details"
  on public.event_details for delete to authenticated
  using ((select public.is_admin()));

create policy "Approved registrants and admins can read payment settings"
  on public.payment_settings for select to authenticated
  using ((select public.is_admin()) or (select public.is_approved_user()));
create policy "Admins can add payment settings"
  on public.payment_settings for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins can change payment settings"
  on public.payment_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Anyone can read the gallery"
  on public.gallery_photos for select to anon, authenticated
  using (true);
create policy "Admins can add gallery photos"
  on public.gallery_photos for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins can change gallery photos"
  on public.gallery_photos for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admins can delete gallery photos"
  on public.gallery_photos for delete to authenticated
  using ((select public.is_admin()));

-- Function permissions
revoke all on function public.is_approved_user() from public, anon;
grant execute on function public.is_approved_user() to authenticated, service_role;

revoke all on function public.auth_user_id(text) from public, anon, authenticated;
grant execute on function public.auth_user_id(text) to service_role;

revoke all on function public.registrant_logins() from public, anon;
grant execute on function public.registrant_logins() to authenticated;

revoke all on function public.resolve_registrant(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.resolve_registrant(text, text, text, boolean) to service_role;

revoke all on function public.register_attendee(text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_attendee(text, text, text, text) to service_role;

revoke all on function public.submit_payment(text, text) from public, anon;
grant execute on function public.submit_payment(text, text) to authenticated;

revoke all on function public.review_payment(uuid, text, text) from public, anon;
grant execute on function public.review_payment(uuid, text, text) to authenticated;

revoke all on function public.dashboard_stats() from public, anon;
grant execute on function public.dashboard_stats() to authenticated;

revoke all on function public.attendees_before_write() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 13. Storage
--   gallery        public: venue photos, anyone can view
--   event-private  private: the payment QR, shown to approved
--                  registrants through short-lived signed links
--   receipts       private (existing): registrants upload through
--                  one-time links into a folder named after their login
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('gallery', 'gallery', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('event-private', 'event-private', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can read gallery files"
  on storage.objects for select to authenticated
  using (bucket_id = 'gallery' and (select public.is_admin()));
create policy "Admins can upload gallery files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and (select public.is_admin()));
create policy "Admins can delete gallery files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and (select public.is_admin()));

create policy "Admins can read private event files"
  on storage.objects for select to authenticated
  using (bucket_id = 'event-private' and (select public.is_admin()));
create policy "Admins can upload private event files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-private' and (select public.is_admin()));
create policy "Admins can delete private event files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'event-private' and (select public.is_admin()));
