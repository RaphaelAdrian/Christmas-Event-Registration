-- =====================================================================
-- Invite list by name
-- Run this AFTER 20261016000000_initial_schema.sql
-- (SQL Editor > New query > paste this whole file > Run).
--
--  * Each person has a first name and a last name; email is optional
--    on the invite list (registrants still give one).
--  * Registration matches the invite list by name:
--      - last name must match (ignoring capitals, accents, spaces,
--        dots, dashes and Jr./Sr./III)
--      - first name matches on a keyword: "Jai" matches "Jairus Miguel",
--        "Miguel" matches too, and a full first name always matches
--  * Invite-only events reject names that aren't on the list.
--  * A name that is already registered is not added again.
--  * If a short name fits two invited people, the form asks for the
--    full first name instead of guessing.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. First name, last name, and the name exactly as the person typed it
-- ---------------------------------------------------------------------
alter table public.attendees
  add column first_name      text not null default '' check (char_length(first_name) <= 100),
  add column last_name       text not null default '' check (char_length(last_name) <= 100),
  add column name_as_entered text check (char_length(name_as_entered) <= 200);

-- Existing rows: the last word (with any "dela", "de los", "San" ... before it)
-- becomes the last name, the rest the first name
update public.attendees
set last_name = coalesce(substring(btrim(full_name) from
      '(?i)^\S+.*?\s((?:(?:de|del|dela|della|delos|la|las|los|da|das|do|dos|di|du|san|santa|santo|sta\.?|sto\.?|van|von|der|den)\s+)*\S+(?:\s+(?:jr|sr|ii|iii|iv)\.?)?)$'),
      '')
where btrim(full_name) <> '';

update public.attendees
set first_name = btrim(left(btrim(full_name), char_length(btrim(full_name)) - char_length(last_name)))
where btrim(full_name) <> '';

-- full_name is now always "first last"
alter table public.attendees drop column full_name;
alter table public.attendees
  add column full_name text generated always as (btrim(first_name || ' ' || last_name)) stored;

-- Email is optional on the invite list (still unique when present)
alter table public.attendees alter column email drop not null;

-- ---------------------------------------------------------------------
-- 2. Name helpers
-- ---------------------------------------------------------------------

-- "Ma. Niña O'Brien-Cruz" -> "ma nina obrien cruz"
create or replace function public.name_key(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(
    lower(translate(coalesce(p, ''),
      'ÁÀÂÄÃÅĀáàâäãåāÉÈÊËĒéèêëēÍÌÎÏĪíìîïīÓÒÔÖÕŌóòôöõōÚÙÛÜŪúùûüūÑñÇç',
      'AAAAAAAaaaaaaaEEEEEeeeeeIIIIIiiiiiOOOOOOooooooUUUUUuuuuuNnCc')),
    '[''’`.]', '', 'g'),
    '[^a-z0-9]+', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

-- Last names compare without spaces or suffixes: "Dela Cruz Jr." = "delacruz"
create or replace function public.last_name_key(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select replace(regexp_replace(public.name_key(p), '(\s(jr|sr|ii|iii|iv|v))+$', ''), ' ', '');
$$;

-- How well a typed first name fits a listed one:
--   0     no match
--   1000  identical ("Jairus Miguel" = "Jairus Miguel")
--   else  2 points per typed word that equals a listed word, 1 point per
--         typed word that is the start of a listed word or vice versa
--         (at least 2 letters): "Jai" vs "Jairus Miguel" = 1
create or replace function public.first_name_score(p_entered text, p_listed text)
returns integer
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  v_entered text := public.name_key(p_entered);
  v_listed  text := public.name_key(p_listed);
  v_words   text[];
  e text;
  l text;
  best integer;
  total integer := 0;
begin
  if v_entered = '' or v_listed = '' then
    return 0;
  end if;
  if v_entered = v_listed then
    return 1000;
  end if;
  v_words := string_to_array(v_listed, ' ');
  foreach e in array string_to_array(v_entered, ' ') loop
    best := 0;
    foreach l in array v_words loop
      if e = l then
        best := 2;
        exit;
      elsif least(length(e), length(l)) >= 2 and (starts_with(l, e) or starts_with(e, l)) then
        best := greatest(best, 1);
      end if;
    end loop;
    total := total + best;
  end loop;
  return total;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. resolve_registrant(): who is this person on the invite list?
--   INVITED             matched an invited person (attendee_id is set)
--   NEW                 not on the list, and the event is open to all
--   NOT_INVITED         not on the list, and the event is invite-only
--   ALREADY_REGISTERED  matched someone who is already registered
--   CANCELLED           matched someone whose registration was cancelled
--   AMBIGUOUS_NAME      the name fits more than one invited person
--   DUPLICATE_EMAIL     the email belongs to someone already registered
--   NAME_REQUIRED       first or last name missing
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
  v_status public.attendee_status;
  v_top    integer;
  v_count  integer;
begin
  if v_last = '' or public.name_key(p_first_name) = '' then
    return query select 'NAME_REQUIRED'::text, null::uuid;
    return;
  end if;

  -- An email already on file wins (e.g. someone using their invite link)
  if v_email <> '' then
    select a.id, a.status into v_id, v_status from public.attendees a where a.email = v_email;
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

  select a.id, a.status into v_id, v_status
  from public.attendees a
  where a.invited_at is not null
    and public.last_name_key(a.last_name) = v_last
    and public.first_name_score(p_first_name, a.first_name) = v_top;

  return query select
    (case v_status
       when 'invited' then 'INVITED'
       when 'cancelled' then 'CANCELLED'
       else 'ALREADY_REGISTERED'
     end)::text,
    v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. register_attendee(): now by first and last name
-- ---------------------------------------------------------------------
drop function if exists public.register_attendee(text, text, text, text, text, text, text, text);
drop function if exists public.email_is_registered(text);

create or replace function public.register_attendee(
  p_first_name         text,
  p_last_name          text,
  p_email              text,
  p_mobile             text,
  p_company            text,
  p_job_title          text,
  p_payment_reference  text,
  p_receipt_path       text,
  p_reference_prefix   text default 'EVT',
  p_invite_only        boolean default true
)
returns table (reference_code text, was_invited boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_prefix  text := upper(coalesce(nullif(btrim(p_reference_prefix), ''), 'EVT'));
  v_first   text := btrim(coalesce(p_first_name, ''));
  v_last    text := btrim(coalesce(p_last_name, ''));
  v_now     timestamptz := now();
  v_outcome text;
  v_id      uuid;
  v_row     public.attendees%rowtype;
  v_code    text;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;
  if v_prefix !~ '^[A-Z0-9]{1,10}$' then
    raise exception 'INVALID_PREFIX' using errcode = 'P0001';
  end if;
  if v_first = '' or v_last = '' then
    raise exception 'NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_payment_reference), '') = '' then
    raise exception 'PAYMENT_REFERENCE_REQUIRED' using errcode = 'P0001';
  end if;

  -- The receipt must exist in the private bucket and not belong to anyone else
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = p_receipt_path
  ) then
    raise exception 'RECEIPT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.attendees a where a.receipt_path = p_receipt_path) then
    raise exception 'RECEIPT_ALREADY_USED' using errcode = 'P0001';
  end if;

  -- One registration at a time, so two people can't claim the same invite
  perform pg_advisory_xact_lock(hashtext('public.register_attendee'));

  select r.outcome, r.attendee_id into v_outcome, v_id
  from public.resolve_registrant(v_first, v_last, v_email, coalesce(p_invite_only, true)) r;

  if v_outcome = 'INVITED' then
    select * into v_row from public.attendees a where a.id = v_id for update;
    if v_row.status <> 'invited' then
      raise exception 'ALREADY_REGISTERED' using errcode = 'P0001';
    end if;

    v_code := coalesce(v_row.reference_code,
                       v_prefix || '-' || lpad(nextval('public.attendee_ref_seq')::text, 4, '0'));
    begin
      update public.attendees a set
        email                        = v_email,
        first_name                   = case when a.first_name = '' then v_first else a.first_name end,
        last_name                    = case when a.last_name = '' then v_last else a.last_name end,
        name_as_entered              = v_first || ' ' || v_last,
        mobile                       = btrim(p_mobile),
        company                      = btrim(p_company),
        job_title                    = nullif(btrim(coalesce(p_job_title, '')), ''),
        payment_reference            = btrim(p_payment_reference),
        receipt_path                 = p_receipt_path,
        reference_code               = v_code,
        status                       = 'confirmed',
        registered_at                = v_now,
        instructions_acknowledged_at = v_now,
        terms_accepted_at            = v_now,
        privacy_consent_at           = v_now
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
        first_name, last_name, name_as_entered, email, mobile, company, job_title,
        payment_reference, receipt_path, reference_code, status, registered_at,
        instructions_acknowledged_at, terms_accepted_at, privacy_consent_at
      ) values (
        v_first, v_last, v_first || ' ' || v_last, v_email, btrim(p_mobile), btrim(p_company),
        nullif(btrim(coalesce(p_job_title, '')), ''), btrim(p_payment_reference), p_receipt_path,
        v_code, 'confirmed', v_now,
        v_now, v_now, v_now
      );
    exception when unique_violation then
      raise exception 'DUPLICATE_EMAIL' using errcode = 'P0001';
    end;
    return query select v_code, false;
    return;
  end if;

  -- NOT_INVITED, ALREADY_REGISTERED, CANCELLED, AMBIGUOUS_NAME, DUPLICATE_EMAIL ...
  raise exception '%', v_outcome using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Permissions: only the website's server (secret key) can run these
-- ---------------------------------------------------------------------
revoke all on function public.resolve_registrant(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.resolve_registrant(text, text, text, boolean) to service_role;

revoke all on function public.register_attendee(text, text, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.register_attendee(text, text, text, text, text, text, text, text, text, boolean) to service_role;

revoke all on function public.name_key(text) from public, anon;
revoke all on function public.last_name_key(text) from public, anon;
revoke all on function public.first_name_score(text, text) from public, anon;
