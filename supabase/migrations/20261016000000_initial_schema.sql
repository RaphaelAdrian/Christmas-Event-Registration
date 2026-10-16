-- =====================================================================
-- Event registration: tables, security rules and the receipts bucket
-- Run this once on a new Supabase project (SQL Editor > New query > Run,
-- or `npx supabase db push` if you use the Supabase CLI).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Statuses
--   invited    = Invited – Not Confirmed (on the invite list, not registered)
--   confirmed  = Confirmed – Will Join  (registered, payment not verified)
--   paid       = Paid                   (an admin verified the payment)
--   cancelled  = Cancelled
-- ---------------------------------------------------------------------
create type public.attendee_status as enum ('invited', 'confirmed', 'paid', 'cancelled');

-- Running number behind reference codes such as EVT-0042
create sequence public.attendee_ref_seq start 1;

-- ---------------------------------------------------------------------
-- Attendees: everyone on the invite list and everyone who registered
-- ---------------------------------------------------------------------
create table public.attendees (
  id                            uuid primary key default gen_random_uuid(),
  reference_code                text unique,
  full_name                     text not null default '' check (char_length(full_name) <= 200),
  email                         text not null check (email = lower(email) and char_length(email) between 3 and 254),
  mobile                        text check (char_length(mobile) <= 30),
  company                       text check (char_length(company) <= 200),
  job_title                     text check (char_length(job_title) <= 200),
  status                        public.attendee_status not null default 'invited',
  payment_reference             text check (char_length(payment_reference) <= 100),
  receipt_path                  text unique,
  instructions_acknowledged_at  timestamptz,
  terms_accepted_at             timestamptz,
  privacy_consent_at            timestamptz,
  invited_at                    timestamptz,
  registered_at                 timestamptz,
  paid_at                       timestamptz,
  cancelled_at                  timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  constraint attendees_email_key unique (email)
);

create index attendees_status_idx on public.attendees (status);
create index attendees_created_at_idx on public.attendees (created_at desc);

comment on table public.attendees is 'Invitees and registrants for the event. Only admins can read or change rows.';

-- ---------------------------------------------------------------------
-- Admin allowlist: only these emails can use /admin
-- Add an admin with:  insert into public.admins (email) values ('you@example.com');
-- ---------------------------------------------------------------------
create table public.admins (
  email      text primary key check (email = lower(email)),
  note       text,
  created_at timestamptz not null default now()
);

comment on table public.admins is 'Emails allowed into /admin. The person also needs a user in Authentication > Users.';

-- ---------------------------------------------------------------------
-- Rate limiting for the public registration form
-- ---------------------------------------------------------------------
create table public.rate_limit_hits (
  id     bigint generated always as identity primary key,
  key    text not null,
  hit_at timestamptz not null default now()
);

create index rate_limit_hits_key_time_idx on public.rate_limit_hits (key, hit_at desc);

-- ---------------------------------------------------------------------
-- Keep email lower-case and stamp the status dates automatically
-- ---------------------------------------------------------------------
create or replace function public.attendees_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));
  new.updated_at := now();

  if tg_op = 'INSERT' then
    if new.status = 'invited' then
      new.invited_at := coalesce(new.invited_at, now());
    end if;
    if new.status in ('confirmed', 'paid') then
      new.registered_at := coalesce(new.registered_at, now());
    end if;
    if new.status = 'paid' then
      new.paid_at := coalesce(new.paid_at, now());
    end if;
    if new.status = 'cancelled' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status in ('confirmed', 'paid') then
      new.registered_at := coalesce(new.registered_at, now());
    end if;

    if new.status = 'paid' then
      new.paid_at := now();
    elsif old.status = 'paid' then
      new.paid_at := null;
    end if;

    if new.status = 'cancelled' then
      new.cancelled_at := now();
    elsif old.status = 'cancelled' then
      new.cancelled_at := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger attendees_before_write
before insert or update on public.attendees
for each row execute function public.attendees_before_write();

-- ---------------------------------------------------------------------
-- is_admin(): true when the signed-in user's confirmed email is on the
-- allowlist. Reads auth.users instead of trusting the token's email claim.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.admins a on a.email = lower(u.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

-- ---------------------------------------------------------------------
-- register_attendee(): the only way a registration gets written.
-- Called by the website's server with the secret key, after it has
-- validated the form, checked the honeypot and applied rate limits.
--   * blocks duplicate emails
--   * turns an invited person into Confirmed – Will Join
--   * checks the receipt was really uploaded and is not reused
--   * issues the reference code (e.g. EVT-0042)
-- ---------------------------------------------------------------------
create or replace function public.register_attendee(
  p_full_name          text,
  p_email              text,
  p_mobile             text,
  p_company            text,
  p_job_title          text,
  p_payment_reference  text,
  p_receipt_path       text,
  p_reference_prefix   text default 'EVT'
)
returns table (reference_code text, was_invited boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_email   text := lower(trim(coalesce(p_email, '')));
  v_prefix  text := upper(coalesce(nullif(trim(p_reference_prefix), ''), 'EVT'));
  v_now     timestamptz := now();
  v_row     public.attendees%rowtype;
  v_code    text;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;
  if v_prefix !~ '^[A-Z0-9]{1,10}$' then
    raise exception 'INVALID_PREFIX' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_payment_reference), '') = '' then
    raise exception 'PAYMENT_REFERENCE_REQUIRED' using errcode = 'P0001';
  end if;

  -- The receipt must exist in the private bucket and not belong to anyone else
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'receipts' and o.name = p_receipt_path
  ) then
    raise exception 'RECEIPT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.attendees a where a.receipt_path = p_receipt_path) then
    raise exception 'RECEIPT_ALREADY_USED' using errcode = 'P0001';
  end if;

  select * into v_row from public.attendees a where a.email = v_email for update;

  if found then
    if v_row.status <> 'invited' then
      raise exception 'DUPLICATE_EMAIL' using errcode = 'P0001';
    end if;

    v_code := coalesce(v_row.reference_code,
                       v_prefix || '-' || lpad(nextval('public.attendee_ref_seq')::text, 4, '0'));

    update public.attendees a set
      full_name                    = trim(p_full_name),
      mobile                       = trim(p_mobile),
      company                      = trim(p_company),
      job_title                    = nullif(trim(coalesce(p_job_title, '')), ''),
      payment_reference            = trim(p_payment_reference),
      receipt_path                 = p_receipt_path,
      reference_code               = v_code,
      status                       = 'confirmed',
      registered_at                = v_now,
      instructions_acknowledged_at = v_now,
      terms_accepted_at            = v_now,
      privacy_consent_at           = v_now
    where a.id = v_row.id;

    return query select v_code, true;
    return;
  end if;

  v_code := v_prefix || '-' || lpad(nextval('public.attendee_ref_seq')::text, 4, '0');

  begin
    insert into public.attendees (
      full_name, email, mobile, company, job_title, payment_reference, receipt_path,
      reference_code, status, registered_at,
      instructions_acknowledged_at, terms_accepted_at, privacy_consent_at
    ) values (
      trim(p_full_name), v_email, trim(p_mobile), trim(p_company),
      nullif(trim(coalesce(p_job_title, '')), ''), trim(p_payment_reference), p_receipt_path,
      v_code, 'confirmed', v_now,
      v_now, v_now, v_now
    );
  exception when unique_violation then
    -- Two submissions with the same email at the same moment
    raise exception 'DUPLICATE_EMAIL' using errcode = 'P0001';
  end;

  return query select v_code, false;
end;
$$;

-- ---------------------------------------------------------------------
-- email_is_registered(): lets the form warn about a duplicate early
-- (before the person uploads a receipt). Server only.
-- ---------------------------------------------------------------------
create or replace function public.email_is_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attendees a
    where a.email = lower(trim(coalesce(p_email, '')))
      and a.status <> 'invited'
  );
$$;

-- ---------------------------------------------------------------------
-- hit_rate_limit(): records one attempt and returns false when the key
-- has already used up its allowance in the window. Server only.
-- ---------------------------------------------------------------------
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));

  delete from public.rate_limit_hits h
  where h.key = p_key and h.hit_at < now() - make_interval(secs => p_window_seconds);

  -- Occasionally clear out old rows for every key
  if random() < 0.02 then
    delete from public.rate_limit_hits h where h.hit_at < now() - interval '1 day';
  end if;

  select count(*) into v_count from public.rate_limit_hits h where h.key = p_key;
  if v_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_hits (key) values (p_key);
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security: on for every table
-- ---------------------------------------------------------------------
alter table public.attendees       enable row level security;
alter table public.admins          enable row level security;
alter table public.rate_limit_hits enable row level security;

-- Logged-out visitors (anon) get nothing at all: no table rights, no policies.
revoke all on table public.attendees, public.admins, public.rate_limit_hits from anon;
revoke all on sequence public.attendee_ref_seq from anon, authenticated;
revoke all on table public.rate_limit_hits from authenticated;
revoke insert, update, delete on table public.admins from authenticated;

-- Admins (signed in and on the allowlist) can read and change attendees
create policy "Admins can read attendees"
  on public.attendees for select to authenticated
  using ((select public.is_admin()));

create policy "Admins can add attendees"
  on public.attendees for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update attendees"
  on public.attendees for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete attendees"
  on public.attendees for delete to authenticated
  using ((select public.is_admin()));

create policy "Admins can read the admin list"
  on public.admins for select to authenticated
  using ((select public.is_admin()));

-- rate_limit_hits has no policies: only the server (secret key) can use it.

-- Function permissions
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

revoke all on function public.register_attendee(text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_attendee(text, text, text, text, text, text, text, text) to service_role;

revoke all on function public.email_is_registered(text) from public, anon, authenticated;
grant execute on function public.email_is_registered(text) to service_role;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

revoke all on function public.attendees_before_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Receipts: a private storage bucket (max 5 MB; images or PDF)
-- Uploads use one-time signed upload links made by the server.
-- Admins open receipts through short-lived signed URLs.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can view receipts"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (select public.is_admin()));

create policy "Admins can delete receipts"
  on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (select public.is_admin()));
