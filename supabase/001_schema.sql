-- =====================================================================
-- 001: full schema for the NPS / CSAT dashboard (run this ONE file).
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- It replaces the old 003 file: everything from 003 is already included.
-- Safe to run again: it only creates what is missing.
-- =====================================================================

create extension if not exists pgcrypto;

do $$ begin
  create type root_cause as enum ('service', 'parts', 'product', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_status as enum ('open', 'contacted', 'resolved', 'unreachable');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Customers: only people with a usable phone number.
-- ---------------------------------------------------------------------
create table if not exists customers (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null unique,
  full_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Surveys: one answer. customer_id is NULL when the phone is unusable
-- (the scores are still real feedback; raw_phone keeps what was typed).
-- vehicle_model, governorate and service_center are plain text on purpose:
-- new models, governorates and centres need no database change.
-- ---------------------------------------------------------------------
create table if not exists surveys (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid references customers (id) on delete set null,
  raw_phone         text,
  survey_date       date not null,
  week_start        date not null,                 -- Monday of survey_date
  csat              smallint check (csat between 1 and 5),
  nps               smallint check (nps between 0 and 10),
  vehicle_model     text,
  governorate       text,
  service_center    text,
  root_cause        root_cause,
  root_cause_detail text,
  comment           text,
  source_file       text,
  source_key        text not null,                 -- fingerprint, used to avoid duplicates
  created_at        timestamptz not null default now(),
  check (csat is not null or nps is not null)
);

-- One answer per customer per week (the latest one wins when a file is uploaded again).
create unique index if not exists surveys_customer_week_key
  on surveys (customer_id, week_start) where customer_id is not null;
-- Answers without a customer are identified by their fingerprint.
create unique index if not exists surveys_nophone_key
  on surveys (source_key) where customer_id is null;

create index if not exists surveys_date_idx        on surveys (survey_date);
create index if not exists surveys_week_idx        on surveys (week_start);
create index if not exists surveys_model_idx       on surveys (vehicle_model);
create index if not exists surveys_governorate_idx on surveys (governorate);
create index if not exists surveys_center_idx      on surveys (service_center);

-- ---------------------------------------------------------------------
-- Recovery tickets: a call-back task for every dissatisfied customer,
-- due 48 hours after the ticket is created.
-- ---------------------------------------------------------------------
create table if not exists action_tickets (
  id           uuid primary key default gen_random_uuid(),
  survey_id    uuid not null unique references surveys (id) on delete cascade,
  customer_id  uuid not null references customers (id) on delete cascade,
  status       ticket_status not null default 'open',
  due_at       timestamptz not null default (now() + interval '48 hours'),
  contacted_at timestamptz,
  resolved_at  timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists tickets_status_idx on action_tickets (status, due_at);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists customers_updated on customers;
create trigger customers_updated before update on customers
  for each row execute function set_updated_at();

drop trigger if exists tickets_updated on action_tickets;
create trigger tickets_updated before update on action_tickets
  for each row execute function set_updated_at();

-- Dissatisfied = CSAT 3 or lower, or NPS 6 or lower (same rule as the dashboard).
-- No customer means nobody to call: those surveys appear in the dashboard's
-- "cannot be contacted" list instead.
-- To ticket only CSAT <= 3, change the condition to:  new.csat <= 3
create or replace function create_ticket_for_low_scores() returns trigger language plpgsql as $$
begin
  if new.customer_id is not null
     and ((new.csat is not null and new.csat <= 3) or (new.nps is not null and new.nps <= 6)) then
    insert into action_tickets (survey_id, customer_id)
    values (new.id, new.customer_id)
    on conflict (survey_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists surveys_ticket on surveys;
create trigger surveys_ticket after insert or update of csat, nps on surveys
  for each row execute function create_ticket_for_low_scores();

-- ---------------------------------------------------------------------
-- save_surveys: saves one uploaded file in a single transaction.
-- Called by the app (server side). Returns how many rows were new / updated.
-- ---------------------------------------------------------------------

-- Turns the JSON sent by the app into rows (empty strings become NULL).
create or replace function incoming_surveys(p_surveys jsonb)
returns table (
  phone text, raw_phone text, customer_name text, survey_date date, week_start date,
  csat int, nps int, comment text, vehicle_model text, governorate text,
  service_center text, root_cause text, root_cause_detail text, source_key text
) language sql immutable as $$
  select
    nullif(x.phone, ''), nullif(x.raw_phone, ''), nullif(x.customer_name, ''),
    x.survey_date, x.week_start, x.csat, x.nps,
    nullif(x.comment, ''), nullif(x.vehicle_model, ''), nullif(x.governorate, ''),
    nullif(x.service_center, ''), nullif(x.root_cause, ''), nullif(x.root_cause_detail, ''),
    x.source_key
  from jsonb_to_recordset(p_surveys) as x(
    phone text, raw_phone text, customer_name text, survey_date date, week_start date,
    csat int, nps int, comment text, vehicle_model text, governorate text,
    service_center text, root_cause text, root_cause_detail text, source_key text
  )
$$;

create or replace function save_surveys(p_surveys jsonb, p_source_file text)
returns jsonb language plpgsql as $$
declare
  v_new int := 0;
  v_updated int := 0;
  v_new_nophone int := 0;
begin
  -- 1) customers (an existing name is kept when the new file has none)
  insert into customers (phone, full_name)
  select distinct on (i.phone) i.phone, i.customer_name
  from incoming_surveys(p_surveys) i
  where i.phone is not null
  order by i.phone, i.survey_date desc
  on conflict (phone) do update
    set full_name = coalesce(excluded.full_name, customers.full_name);

  -- 2) surveys with a customer: one per customer per week, the newest answer wins
  with ins as (
    insert into surveys (customer_id, raw_phone, survey_date, week_start, csat, nps, vehicle_model,
                         governorate, service_center, root_cause, root_cause_detail, comment,
                         source_file, source_key)
    select c.id, i.raw_phone, i.survey_date, i.week_start, i.csat, i.nps, i.vehicle_model,
           i.governorate, i.service_center, i.root_cause::root_cause, i.root_cause_detail, i.comment,
           p_source_file, i.source_key
    from incoming_surveys(p_surveys) i
    join customers c on c.phone = i.phone
    on conflict (customer_id, week_start) where customer_id is not null do update set
      raw_phone = excluded.raw_phone, survey_date = excluded.survey_date,
      csat = excluded.csat, nps = excluded.nps, vehicle_model = excluded.vehicle_model,
      governorate = excluded.governorate, service_center = excluded.service_center,
      root_cause = excluded.root_cause, root_cause_detail = excluded.root_cause_detail,
      comment = excluded.comment, source_file = excluded.source_file, source_key = excluded.source_key
    where excluded.survey_date >= surveys.survey_date
    returning (xmax = 0) as is_new
  )
  select count(*) filter (where is_new), count(*) filter (where not is_new)
  into v_new, v_updated from ins;

  -- 3) surveys without a usable phone (identified by their fingerprint)
  with ins as (
    insert into surveys (customer_id, raw_phone, survey_date, week_start, csat, nps, vehicle_model,
                         governorate, service_center, root_cause, root_cause_detail, comment,
                         source_file, source_key)
    select null::uuid, i.raw_phone, i.survey_date, i.week_start, i.csat, i.nps, i.vehicle_model,
           i.governorate, i.service_center, i.root_cause::root_cause, i.root_cause_detail, i.comment,
           p_source_file, i.source_key
    from incoming_surveys(p_surveys) i
    where i.phone is null
    on conflict (source_key) where customer_id is null do nothing
    returning 1
  )
  select count(*) into v_new_nophone from ins;

  return jsonb_build_object('inserted', v_new + v_new_nophone, 'updated', v_updated);
end $$;

-- ---------------------------------------------------------------------
-- Security: nobody can read or write with the public (anon) key.
-- The app uses the server-side service role key, which bypasses these rules.
-- ---------------------------------------------------------------------
alter table customers      enable row level security;
alter table surveys        enable row level security;
alter table action_tickets enable row level security;

revoke all on function save_surveys(jsonb, text) from public, anon, authenticated;
revoke all on function incoming_surveys(jsonb) from public, anon, authenticated;
grant execute on function save_surveys(jsonb, text) to service_role;
grant execute on function incoming_surveys(jsonb) to service_role;
