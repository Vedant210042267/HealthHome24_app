-- =====================================================================================
--  HealthHome24 — Home-Care Operations & Management System
--  Production PostgreSQL / Supabase schema
--  ---------------------------------------------------------------------------------
--  Target      : Supabase (PostgreSQL 15+), Next.js App Router client
--  Currency    : INR (all money columns are numeric(12,2), never float)
--  Timezone    : all timestamps are timestamptz; render in Asia/Kolkata on the client
--  Idempotent  : safe to run more than once (create ... if not exists / or replace)
--
--  RUN ORDER   : paste this whole file into the Supabase SQL Editor and execute once.
--                Section 12 (seed data) is optional — delete it before going live.
--                The script is idempotent: re-running it is a no-op, and the seed
--                block skips itself if the sample patients are already present.
--
--  VERIFIED    : executed end to end on PostgreSQL 16 against a stubbed Supabase
--                auth schema. 20 tables, 11 views, 86 indexes, 51 RLS policies.
--
--  SECTIONS
--    01  Extensions, domains and enumerated types
--    02  Utility functions (updated_at, audit, geo, auth helpers)
--    03  Identity: profiles bound to auth.users
--    04  Masters: doctors, patients, staff, KYC, bank accounts, documents
--    05  Operations: duty allocations, attendance, leave
--    06  Money: advances & loans, payments, invoices, payroll, expenses
--    07  Triggers
--    08  Indexes
--    09  Reporting views (salary, billing, profitability)
--    10  Settlement functions (freeze payroll, generate invoice)
--    11  Row Level Security + grants
--    12  Sample data
--    13  Verification queries
--    14  Appendix: how the Next.js app talks to this schema
-- =====================================================================================

set search_path = public, extensions;

-- =====================================================================================
--  SECTION 01 — EXTENSIONS, DOMAINS, ENUMS
-- =====================================================================================

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'extensions') then
    execute 'create extension if not exists pgcrypto   with schema extensions';  -- gen_random_uuid()
    execute 'create extension if not exists btree_gist with schema extensions';  -- overlap exclusion constraints
    execute 'create extension if not exists pg_trgm    with schema extensions';  -- fuzzy name search
  else
    execute 'create extension if not exists pgcrypto';
    execute 'create extension if not exists btree_gist';
    execute 'create extension if not exists pg_trgm';
  end if;
end $$;

-- ---------------------------------------------------------------------------------
--  Domains: India-specific formats validated once, reused everywhere.
-- ---------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'indian_mobile' and typnamespace = 'public'::regnamespace) then
    create domain public.indian_mobile as text
      check (value ~ '^[6-9][0-9]{9}$');
    comment on domain public.indian_mobile is 'Bare 10-digit Indian mobile number. Strip +91/0 before insert.';
  end if;

  if not exists (select 1 from pg_type where typname = 'indian_pincode' and typnamespace = 'public'::regnamespace) then
    create domain public.indian_pincode as text
      check (value ~ '^[1-9][0-9]{5}$');
  end if;

  if not exists (select 1 from pg_type where typname = 'pan_number' and typnamespace = 'public'::regnamespace) then
    create domain public.pan_number as text
      check (value ~ '^[A-Z]{5}[0-9]{4}[A-Z]$');
  end if;

  if not exists (select 1 from pg_type where typname = 'aadhaar_number' and typnamespace = 'public'::regnamespace) then
    -- Accepts a masked value (XXXXXXXX1234) as well as the full 12 digits.
    -- STRONGLY prefer masked storage: see the note on public.staff_kyc.
    create domain public.aadhaar_number as text
      check (value ~ '^([0-9]{8}|X{8})[0-9]{4}$');
  end if;

  if not exists (select 1 from pg_type where typname = 'ifsc_code' and typnamespace = 'public'::regnamespace) then
    create domain public.ifsc_code as text
      check (value ~ '^[A-Z]{4}0[A-Z0-9]{6}$');
  end if;

  if not exists (select 1 from pg_type where typname = 'gstin' and typnamespace = 'public'::regnamespace) then
    create domain public.gstin as text
      check (value ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');
  end if;

  if not exists (select 1 from pg_type where typname = 'money_inr' and typnamespace = 'public'::regnamespace) then
    create domain public.money_inr as numeric(12,2)
      check (value >= 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------------
--  Enums
-- ---------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname='user_role' and typnamespace='public'::regnamespace) then
    create type public.user_role as enum ('admin','coordinator','accountant','attendant');
  end if;

  if not exists (select 1 from pg_type where typname='gender' and typnamespace='public'::regnamespace) then
    create type public.gender as enum ('male','female','other','undisclosed');
  end if;

  if not exists (select 1 from pg_type where typname='patient_status' and typnamespace='public'::regnamespace) then
    create type public.patient_status as enum ('enquiry','active','on_hold','discharged','cancelled','deceased');
  end if;

  if not exists (select 1 from pg_type where typname='service_type' and typnamespace='public'::regnamespace) then
    create type public.service_type as enum
      ('attendant_12h','attendant_24h','nurse_12h','nurse_24h','nurse_visit');
  end if;

  if not exists (select 1 from pg_type where typname='billing_cycle' and typnamespace='public'::regnamespace) then
    create type public.billing_cycle as enum ('monthly','fortnightly','weekly','on_completion');
  end if;

  if not exists (select 1 from pg_type where typname='staff_category' and typnamespace='public'::regnamespace) then
    create type public.staff_category as enum ('nurse','general_attendant','physiotherapist','supervisor');
  end if;

  if not exists (select 1 from pg_type where typname='kyc_status' and typnamespace='public'::regnamespace) then
    create type public.kyc_status as enum ('pending','submitted','verified','rejected','expired');
  end if;

  if not exists (select 1 from pg_type where typname='document_type' and typnamespace='public'::regnamespace) then
    create type public.document_type as enum
      ('aadhaar','pan','photo','address_proof','police_verification','nursing_council_certificate',
       'qualification_certificate','bank_proof','signed_contract','medical_fitness','other');
  end if;

  if not exists (select 1 from pg_type where typname='duty_type' and typnamespace='public'::regnamespace) then
    create type public.duty_type as enum ('shift_12h','shift_24h','visit');
  end if;

  if not exists (select 1 from pg_type where typname='shift_slot' and typnamespace='public'::regnamespace) then
    create type public.shift_slot as enum ('day','night','full_day','visit');
  end if;

  if not exists (select 1 from pg_type where typname='allocation_status' and typnamespace='public'::regnamespace) then
    create type public.allocation_status as enum ('ongoing','completed','cancelled','on_hold');
  end if;

  if not exists (select 1 from pg_type where typname='attendance_status' and typnamespace='public'::regnamespace) then
    create type public.attendance_status as enum
      ('present','half_day','absent','replaced','week_off','paid_leave','unpaid_leave');
  end if;

  if not exists (select 1 from pg_type where typname='check_in_source' and typnamespace='public'::regnamespace) then
    create type public.check_in_source as enum ('mobile_gps','manual','supervisor','biometric');
  end if;

  if not exists (select 1 from pg_type where typname='leave_type' and typnamespace='public'::regnamespace) then
    create type public.leave_type as enum ('paid','unpaid','sick','emergency','festival');
  end if;

  if not exists (select 1 from pg_type where typname='request_status' and typnamespace='public'::regnamespace) then
    create type public.request_status as enum ('pending','approved','rejected','cancelled');
  end if;

  if not exists (select 1 from pg_type where typname='advance_type' and typnamespace='public'::regnamespace) then
    create type public.advance_type as enum ('advance','loan','festival_advance');
  end if;

  if not exists (select 1 from pg_type where typname='advance_status' and typnamespace='public'::regnamespace) then
    create type public.advance_status as enum ('open','closed','written_off');
  end if;

  if not exists (select 1 from pg_type where typname='adjustment_kind' and typnamespace='public'::regnamespace) then
    create type public.adjustment_kind as enum ('addition','deduction');
  end if;

  if not exists (select 1 from pg_type where typname='payment_mode' and typnamespace='public'::regnamespace) then
    create type public.payment_mode as enum ('cash','upi','bank_transfer','cheque','card','other');
  end if;

  if not exists (select 1 from pg_type where typname='payment_direction' and typnamespace='public'::regnamespace) then
    create type public.payment_direction as enum ('advance','against_invoice','refund','security_deposit');
  end if;

  if not exists (select 1 from pg_type where typname='invoice_status' and typnamespace='public'::regnamespace) then
    create type public.invoice_status as enum ('draft','issued','partially_paid','paid','cancelled','written_off');
  end if;

  if not exists (select 1 from pg_type where typname='payroll_status' and typnamespace='public'::regnamespace) then
    create type public.payroll_status as enum ('draft','approved','paid','cancelled');
  end if;

  if not exists (select 1 from pg_type where typname='payslip_payment_status' and typnamespace='public'::regnamespace) then
    create type public.payslip_payment_status as enum ('unpaid','partially_paid','paid','on_hold');
  end if;

  if not exists (select 1 from pg_type where typname='expense_category' and typnamespace='public'::regnamespace) then
    create type public.expense_category as enum
      ('travel','consumables','ppe','uniform','recruitment','training','office_rent','salaries_admin',
       'marketing','licence_compliance','staff_welfare','replacement_cost','other');
  end if;
end $$;

-- =====================================================================================
--  SECTION 02 — UTILITY FUNCTIONS
-- =====================================================================================

-- Keeps updated_at honest. Attached to every table that has the column (Section 07).
create or replace function public.fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Great-circle distance in metres. Used to verify a GPS check-in was actually made
-- at the patient's address rather than from the attendant's own home.
create or replace function public.fn_haversine_meters(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
) returns numeric
language sql immutable parallel safe as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else round(
      (6371000 * 2 * asin(sqrt(
          power(sin(radians((lat2 - lat1)::double precision) / 2), 2)
        + cos(radians(lat1::double precision)) * cos(radians(lat2::double precision))
        * power(sin(radians((lon2 - lon1)::double precision) / 2), 2)
      )))::numeric, 1)
  end;
$$;

-- Month bucket as an IMMUTABLE expression. date_trunc() over a `date` silently
-- resolves to the timestamptz overload, which is only STABLE and therefore cannot
-- be indexed or used in a CHECK. Every monthly rollup goes through this instead,
-- so the settlement views can actually use idx_att_staff_month et al.
create or replace function public.month_of(d date)
returns date language sql immutable parallel safe as $$
  select date_trunc('month', d::timestamp)::date;
$$;

-- A shift as the hours it occupies, so overlaps can be detected exactly.
-- day = 08:00-20:00, night = 20:00-08:00 (hours 20-32), full_day = the whole day.
-- Used by the attendance double-booking exclusion constraint.
create or replace function public.slot_hours(p public.shift_slot)
returns int4range language sql immutable parallel safe as $$
  select case p
           when 'day'      then int4range(8, 20)
           when 'night'    then int4range(20, 32)
           when 'full_day' then int4range(0, 24)
           else null
         end;
$$;

-- ---------------------------------------------------------------------------------
--  Financial-year aware document numbering (Indian FY runs 01-Apr to 31-Mar).
-- ---------------------------------------------------------------------------------
create sequence if not exists public.patient_code_seq  start 1001;
create sequence if not exists public.staff_code_seq    start 1001;
create sequence if not exists public.invoice_number_seq start 1;
create sequence if not exists public.receipt_number_seq start 1;

create or replace function public.fn_financial_year(p_date date default current_date)
returns text language sql immutable as $$
  select case
    when extract(month from p_date) >= 4
      then to_char(p_date, 'YYYY') || '-' || to_char(p_date + interval '1 year', 'YY')
      else to_char(p_date - interval '1 year', 'YYYY') || '-' || to_char(p_date, 'YY')
  end;
$$;

create or replace function public.fn_next_invoice_number(p_date date default current_date)
returns text language sql volatile as $$
  select 'HH24/' || public.fn_financial_year(p_date) || '/'
         || lpad(nextval('public.invoice_number_seq')::text, 5, '0');
$$;

create or replace function public.fn_next_receipt_number(p_date date default current_date)
returns text language sql volatile as $$
  select 'RCPT/' || public.fn_financial_year(p_date) || '/'
         || lpad(nextval('public.receipt_number_seq')::text, 5, '0');
$$;

-- ---------------------------------------------------------------------------------
--  Audit trail. Attached to the tables where "who changed this number?" gets asked.
-- ---------------------------------------------------------------------------------
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  table_name   text        not null,
  record_id    uuid,
  action       text        not null check (action in ('INSERT','UPDATE','DELETE')),
  actor_id     uuid,
  old_data     jsonb,
  new_data     jsonb,
  changed_at   timestamptz not null default now()
);

create or replace function public.fn_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
begin
  insert into public.audit_log (table_name, record_id, action, actor_id, old_data, new_data)
  values (
    tg_table_name,
    coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid),
    tg_op,
    auth.uid(),
    v_old,
    v_new
  );
  return coalesce(new, old);
end $$;

-- =====================================================================================
--  SECTION 03 — IDENTITY
--  One row per login. `role` drives every RLS policy in Section 11.
--  `staff_id` links an attendant's login to their staff record so the mobile app can
--  answer "show me my duties" without trusting anything the client sends.
-- =====================================================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  role         public.user_role not null default 'attendant',
  phone        public.indian_mobile,
  staff_id     uuid,                       -- FK added in Section 04, after public.staff exists
  is_active    boolean not null default true,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Application identity. One row per auth.users row; role drives all RLS.';

-- ---------------------------------------------------------------------------------
--  Auth helpers.
--  SECURITY DEFINER so they can read public.profiles without tripping the RLS
--  policy that is itself defined in terms of these functions (infinite recursion).
--  They return NULL when there is no JWT, which is how the Supabase SQL Editor,
--  the service_role key and cron jobs run — see the guards in Section 10.
-- ---------------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.current_staff_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select p.staff_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.current_app_role() = 'admin';
$$;

-- Admin + accountant: may see and move money.
create or replace function public.is_finance()
returns boolean language sql stable as $$
  select public.current_app_role() in ('admin','accountant');
$$;

-- Everyone who works in the office, as opposed to an attendant on a duty.
create or replace function public.is_back_office()
returns boolean language sql stable as $$
  select public.current_app_role() in ('admin','coordinator','accountant');
$$;

-- True for trusted server-side execution: the SQL Editor, the service_role key,
-- a pg_cron job — anything without an end-user JWT.
create or replace function public.is_service_context()
returns boolean language sql stable as $$
  select auth.uid() is null;
$$;

-- Auto-create a profile whenever Supabase Auth creates a user.
-- Pass full_name / role / staff_id through signUp options.data on the client.
create or replace function public.fn_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, phone, staff_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email,''), '@', 1), 'New user'),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'attendant'),
    nullif(new.raw_user_meta_data ->> 'phone', '')::public.indian_mobile,
    nullif(new.raw_user_meta_data ->> 'staff_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- =====================================================================================
--  SECTION 04 — MASTERS
-- =====================================================================================

-- ---------------------------------------------------------------------------------
--  4.1  Doctors (referring / treating)
-- ---------------------------------------------------------------------------------
create table if not exists public.doctors (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null,
  qualification       text,
  specialization      text,
  registration_number text,
  hospital_name       text,
  clinic_address      text,
  phone               public.indian_mobile,
  alternate_phone     public.indian_mobile,
  email               text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.doctors is 'Referring and treating consultants. A patient may cite one of each.';

-- ---------------------------------------------------------------------------------
--  4.2  Patients
--  Rate and service type here are the DEFAULTS used when opening a new duty
--  allocation. The rate that actually bills is the one snapshotted on the
--  allocation and then onto each attendance row, so a mid-month rate revision
--  never rewrites history.
-- ---------------------------------------------------------------------------------
create table if not exists public.patients (
  id                       uuid primary key default gen_random_uuid(),
  patient_code             text not null unique
                             default ('HH-P-' || lpad(nextval('public.patient_code_seq')::text, 5, '0')),

  -- Identity
  full_name                text not null check (length(btrim(full_name)) > 1),
  gender                   public.gender,
  date_of_birth            date check (date_of_birth is null or date_of_birth <= current_date),
  age_years                smallint check (age_years is null or age_years between 0 and 130),

  -- Address (Mumbai default; latitude/longitude power the attendance geo-fence)
  address_line1            text not null,
  address_line2            text,
  landmark                 text,
  area                     text,
  city                     text not null default 'Mumbai',
  state                    text not null default 'Maharashtra',
  pincode                  public.indian_pincode,
  latitude                 numeric(9,6)  check (latitude  between -90  and 90),
  longitude                numeric(9,6)  check (longitude between -180 and 180),
  geofence_radius_m        integer not null default 300 check (geofence_radius_m between 50 and 5000),

  -- Contacts
  primary_contact_name     text not null,
  primary_contact_phone    public.indian_mobile not null,
  primary_contact_relation text,
  family_contact_name      text,
  family_contact_phone     public.indian_mobile,
  family_contact_relation  text,

  -- Clinical
  referring_doctor_id      uuid references public.doctors(id) on delete set null,
  treating_doctor_id       uuid references public.doctors(id) on delete set null,
  doctor_notes             text,
  diagnosis                text,
  care_requirements        text,
  mobility_status          text,
  allergies                text,
  current_medications      text,
  attendant_gender_pref    public.gender,
  language_preference      text[],

  -- Commercials
  service_type             public.service_type not null,
  default_daily_rate       public.money_inr not null,
  billing_cycle            public.billing_cycle not null default 'monthly',
  security_deposit         public.money_inr not null default 0,
  gst_applicable           boolean not null default false,
  customer_gstin           public.gstin,

  -- Lifecycle
  start_date               date not null default current_date,
  end_date                 date,
  status                   public.patient_status not null default 'active',
  discharge_reason         text,
  referral_source          text,
  notes                    text,

  created_by               uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint patients_dates_chk    check (end_date is null or end_date >= start_date),
  constraint patients_closed_chk   check (status <> 'discharged' or end_date is not null),
  constraint patients_geo_chk      check (num_nulls(latitude, longitude) <> 1)
);

comment on column public.patients.default_daily_rate is
  'Default INR charged to the patient per day (or per visit for nurse_visit). Copied onto new duty allocations.';
comment on column public.patients.geofence_radius_m is
  'Radius from lat/long inside which a GPS check-in counts as on-site. Flagged, never blocked.';

-- ---------------------------------------------------------------------------------
--  4.3  Staff (nurses and general attendants)
-- ---------------------------------------------------------------------------------
create table if not exists public.staff (
  id                        uuid primary key default gen_random_uuid(),
  staff_code                text not null unique
                              default ('HH-S-' || lpad(nextval('public.staff_code_seq')::text, 5, '0')),

  full_name                 text not null check (length(btrim(full_name)) > 1),
  category                  public.staff_category not null,
  gender                    public.gender,
  date_of_birth             date check (date_of_birth is null or date_of_birth <= current_date),

  phone                     public.indian_mobile not null,
  alternate_phone           public.indian_mobile,
  email                     text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  emergency_contact_name    text not null,
  emergency_contact_phone   public.indian_mobile not null,
  emergency_contact_relation text,

  -- Present address plus native place: home-care staff are usually migrant workers
  -- and the native address is what actually reaches the family in an emergency.
  address_line1             text,
  address_line2             text,
  area                      text,
  city                      text default 'Mumbai',
  state                     text default 'Maharashtra',
  pincode                   public.indian_pincode,
  native_address            text,

  qualification             text,
  specialization            text,
  experience_years          numeric(4,1) check (experience_years is null or experience_years between 0 and 60),
  languages                 text[],
  nursing_council_reg_no    text,

  joining_date              date not null default current_date,
  exit_date                 date,
  exit_reason               text,

  default_daily_wage        public.money_inr not null,
  default_ot_hourly_rate    public.money_inr not null default 0,

  photo_path                text,
  is_active                 boolean not null default true,
  notes                     text,

  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint staff_exit_chk   check (exit_date is null or exit_date >= joining_date),
  constraint staff_active_chk check (is_active = false or exit_date is null)
);

comment on column public.staff.default_daily_wage is
  'Default INR paid to this attendant per full duty. Copied onto new duty allocations.';

-- Close the loop between a login and a staff record.
alter table public.profiles drop constraint if exists profiles_staff_id_fkey;
alter table public.profiles
  add constraint profiles_staff_id_fkey
  foreign key (staff_id) references public.staff(id) on delete set null;

-- ---------------------------------------------------------------------------------
--  4.4  KYC — separated from public.staff on purpose.
--
--  COMPLIANCE NOTE (India): under the Aadhaar Act and UIDAI rules a private agency
--  should not warehouse full Aadhaar numbers. Store the MASKED form ('XXXXXXXX1234')
--  — the domain accepts it — keep the scan itself in a PRIVATE Supabase Storage
--  bucket and reference it by path here. This table is admin-only under RLS, which
--  is precisely why it is not a set of columns on public.staff.
-- ---------------------------------------------------------------------------------
create table if not exists public.staff_kyc (
  staff_id           uuid primary key references public.staff(id) on delete cascade,
  aadhaar_number     public.aadhaar_number,
  pan_number         public.pan_number,
  uan_number         text check (uan_number is null or uan_number ~ '^[0-9]{12}$'),   -- EPFO
  esic_number        text check (esic_number is null or esic_number ~ '^[0-9]{10,17}$'),
  aadhaar_doc_path   text,
  pan_doc_path       text,
  kyc_status         public.kyc_status not null default 'pending',
  police_verified    boolean not null default false,
  police_verified_on date,
  verified_by        uuid references public.profiles(id) on delete set null,
  verified_at        timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint staff_kyc_verified_chk
    check (kyc_status <> 'verified' or (verified_by is not null and verified_at is not null))
);

create table if not exists public.staff_documents (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references public.staff(id) on delete cascade,
  doc_type     public.document_type not null,
  file_name    text,
  storage_path text not null,                       -- private Supabase Storage object path
  status       public.kyc_status not null default 'submitted',
  issued_on    date,
  expires_on   date,
  verified_by  uuid references public.profiles(id) on delete set null,
  verified_at  timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint staff_documents_expiry_chk check (expires_on is null or issued_on is null or expires_on >= issued_on)
);

-- ---------------------------------------------------------------------------------
--  4.5  Bank accounts — finance-only under RLS.
-- ---------------------------------------------------------------------------------
create table if not exists public.staff_bank_accounts (
  id                  uuid primary key default gen_random_uuid(),
  staff_id            uuid not null references public.staff(id) on delete cascade,
  account_holder_name text not null,
  account_number      text not null check (account_number ~ '^[0-9]{9,18}$'),
  ifsc_code           public.ifsc_code not null,
  bank_name           text not null,
  branch_name         text,
  account_type        text check (account_type in ('savings','current')),
  upi_id              text,
  is_primary          boolean not null default true,
  is_verified         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint staff_bank_unique unique (staff_id, account_number, ifsc_code)
);

-- Exactly one primary account per staff member.
create unique index if not exists uq_staff_primary_bank
  on public.staff_bank_accounts (staff_id) where is_primary;

-- =====================================================================================
--  SECTION 05 — OPERATIONS
-- =====================================================================================

-- ---------------------------------------------------------------------------------
--  5.1  Duty allocation — the contract between one patient and one attendant.
--
--  Both sides of the margin live here: what the patient pays per day and what the
--  attendant earns per day. Replacing an attendant means closing this allocation
--  and opening a new one, so the rate history stays intact.
-- ---------------------------------------------------------------------------------
create table if not exists public.duty_allocations (
  id                    uuid primary key default gen_random_uuid(),
  patient_id            uuid not null references public.patients(id) on delete restrict,
  staff_id              uuid not null references public.staff(id)    on delete restrict,

  duty_type             public.duty_type  not null,
  shift_slot            public.shift_slot not null default 'full_day',

  start_date            date not null,
  end_date              date,

  patient_daily_rate    public.money_inr not null,   -- e.g. 1800.00 billed per day
  staff_daily_wage      public.money_inr not null,   -- e.g. 1200.00 paid per day
  ot_hourly_rate        public.money_inr not null default 0,

  status                public.allocation_status not null default 'ongoing',
  end_reason            text,
  replaces_allocation_id uuid references public.duty_allocations(id) on delete set null,
  notes                 text,

  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint duty_alloc_dates_chk  check (end_date is null or end_date >= start_date),
  constraint duty_alloc_closed_chk check (status <> 'completed' or end_date is not null),
  constraint duty_alloc_slot_chk   check (
        (duty_type = 'shift_24h' and shift_slot = 'full_day')
     or (duty_type = 'shift_12h' and shift_slot in ('day','night'))
     or (duty_type = 'visit'     and shift_slot = 'visit')
  ),

  -- A person cannot live at two houses round the clock. 12h shifts are exempt
  -- (an attendant may legitimately hold a day slot and a night slot).
  constraint duty_alloc_no_24h_overlap
    exclude using gist (
      staff_id with =,
      daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
    ) where (status in ('ongoing','on_hold') and duty_type = 'shift_24h')
);

comment on table public.duty_allocations is
  'Patient <-> attendant posting. Carries both the billing rate and the wage rate for this posting.';

-- ---------------------------------------------------------------------------------
--  5.2  Leave
-- ---------------------------------------------------------------------------------
create table if not exists public.leave_requests (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references public.staff(id) on delete cascade,
  from_date    date not null,
  to_date      date not null,
  leave_type   public.leave_type not null default 'unpaid',
  reason       text,
  status       public.request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_by   uuid references public.profiles(id) on delete set null,
  decided_at   timestamptz,
  decision_note text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint leave_dates_chk    check (to_date >= from_date),
  constraint leave_decided_chk  check (status = 'pending' or decided_at is not null)
);

-- ---------------------------------------------------------------------------------
--  5.3  Attendance — one row per allocation per day (per visit for nurse visits).
--
--  This table is the single source of truth for BOTH sides of the ledger:
--    patient_units * patient_rate_applied  -> revenue
--    staff_units   * staff_wage_applied    -> cost
--
--  Rates are snapshotted from the allocation on insert (Section 07), so editing an
--  allocation's rate tomorrow cannot silently restate last month's invoice.
--
--  REPLACEMENT PATTERN
--    original row : status = 'replaced',      is_billable = true   -> patient billed 1, absent attendant paid 0
--    relief row   : status = 'present',       is_replacement = true, is_billable = false -> relief paid 1, patient not billed twice
-- ---------------------------------------------------------------------------------
create table if not exists public.attendance (
  id                     uuid primary key default gen_random_uuid(),
  duty_allocation_id     uuid not null references public.duty_allocations(id) on delete restrict,
  staff_id               uuid not null references public.staff(id)    on delete restrict,
  patient_id             uuid not null references public.patients(id) on delete restrict,

  duty_date              date not null,
  visit_sequence         smallint not null default 1 check (visit_sequence between 1 and 12),
  shift_slot             public.shift_slot not null default 'full_day',
  status                 public.attendance_status not null default 'present',

  -- GPS check-in / check-out
  check_in_at            timestamptz,
  check_in_lat           numeric(9,6)  check (check_in_lat  between -90  and 90),
  check_in_lng           numeric(9,6)  check (check_in_lng  between -180 and 180),
  check_in_accuracy_m    numeric(6,1),
  check_in_source        public.check_in_source not null default 'mobile_gps',
  check_out_at           timestamptz,
  check_out_lat          numeric(9,6)  check (check_out_lat between -90  and 90),
  check_out_lng          numeric(9,6)  check (check_out_lng between -180 and 180),
  check_out_accuracy_m   numeric(6,1),
  check_out_source       public.check_in_source,

  overtime_hours         numeric(5,2) not null default 0 check (overtime_hours between 0 and 24),

  -- Rate snapshot (filled from the allocation by trigger when left null)
  patient_rate_applied      public.money_inr not null default 0,
  staff_wage_applied        public.money_inr not null default 0,
  ot_hourly_rate_applied    public.money_inr not null default 0,

  is_billable            boolean not null default true,
  is_replacement         boolean not null default false,
  replacement_staff_id   uuid references public.staff(id) on delete set null,
  leave_request_id       uuid references public.leave_requests(id) on delete set null,
  notes                  text,

  marked_by              uuid references public.profiles(id) on delete set null,
  verified_by            uuid references public.profiles(id) on delete set null,
  verified_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- Billable duty units owed by the patient for this row
  patient_units numeric(4,2) generated always as (
    case
      when is_billable = false                     then 0
      when status in ('present','replaced')        then 1
      when status = 'half_day'                     then 0.5
      else 0
    end
  ) stored,

  -- Payable duty units owed to the attendant for this row
  staff_units numeric(4,2) generated always as (
    case
      when status = 'present'    then 1
      when status = 'half_day'   then 0.5
      when status = 'paid_leave' then 1
      else 0
    end
  ) stored,

  constraint attendance_times_chk    check (check_out_at is null or check_in_at is null or check_out_at > check_in_at),
  constraint attendance_geo_in_chk   check (num_nulls(check_in_lat,  check_in_lng)  <> 1),
  constraint attendance_geo_out_chk  check (num_nulls(check_out_lat, check_out_lng) <> 1),
  constraint attendance_replaced_chk check (status <> 'replaced' or replacement_staff_id is not null),
  constraint attendance_unique_row   unique (duty_allocation_id, duty_date, visit_sequence, staff_id)
);

comment on table public.attendance is
  'Daily duty record. Drives payroll, patient billing and profitability. Rates are snapshotted, never joined live.';
comment on column public.attendance.patient_units is
  'Generated. Duty units billable to the patient: present/replaced = 1, half_day = 0.5, otherwise 0.';
comment on column public.attendance.staff_units is
  'Generated. Duty units payable to the attendant: present/paid_leave = 1, half_day = 0.5, otherwise 0.';

-- One body, one place, one shift. A 24-hour posting collides with both the day and
-- the night 12-hour slot, so the check is a true overlap test, not slot equality.
-- Nurse visits are exempt: several a day is normal.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attendance_no_double_booking') then
    alter table public.attendance
      add constraint attendance_no_double_booking
      exclude using gist (
        staff_id with =,
        duty_date with =,
        public.slot_hours(shift_slot) with &&
      ) where (status in ('present','half_day') and shift_slot <> 'visit');
  end if;
end $$;

-- =====================================================================================
--  SECTION 06 — MONEY
--  Live views (Section 09) compute what things *should* be; the tables below freeze
--  what was actually paid and actually billed, so a back-dated attendance edit can
--  never silently restate a payslip you have already handed over in cash.
-- =====================================================================================

-- ---------------------------------------------------------------------------------
--  6.1  Payroll run — one per calendar month, locked once approved.
-- ---------------------------------------------------------------------------------
create table if not exists public.payroll_runs (
  id              uuid primary key default gen_random_uuid(),
  period_month    date not null unique,          -- always the 1st of the month
  status          public.payroll_status not null default 'draft',
  total_gross     numeric(14,2) not null default 0,
  total_deductions numeric(14,2) not null default 0,
  total_net       numeric(14,2) not null default 0,
  staff_count     integer not null default 0,
  notes           text,
  generated_at    timestamptz not null default now(),
  approved_by     uuid references public.profiles(id) on delete set null,
  approved_at     timestamptz,
  paid_at         timestamptz,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint payroll_runs_month_chk    check (period_month = public.month_of(period_month)),
  constraint payroll_runs_approved_chk check (status not in ('approved','paid') or approved_at is not null)
);

create table if not exists public.payroll_items (
  id                uuid primary key default gen_random_uuid(),
  payroll_run_id    uuid not null references public.payroll_runs(id) on delete cascade,
  staff_id          uuid not null references public.staff(id) on delete restrict,
  period_month      date not null,

  days_present      integer not null default 0,
  half_days         integer not null default 0,
  days_absent       integer not null default 0,
  paid_leave_days   integer not null default 0,
  replacement_duties integer not null default 0,
  payable_units     numeric(6,2) not null default 0,
  overtime_hours    numeric(6,2) not null default 0,

  gross_wage        numeric(12,2) not null default 0,
  overtime_amount   numeric(12,2) not null default 0,
  additions         numeric(12,2) not null default 0,   -- bonus, incentive, arrears
  other_deductions  numeric(12,2) not null default 0,   -- damages, uniform, PF/ESIC employee share
  advance_recovery  numeric(12,2) not null default 0,

  net_payable numeric(12,2) generated always as
    (gross_wage + overtime_amount + additions - other_deductions - advance_recovery) stored,

  payment_status    public.payslip_payment_status not null default 'unpaid',
  paid_amount       numeric(12,2) not null default 0,
  paid_at           timestamptz,
  payment_mode      public.payment_mode,
  payment_reference text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint payroll_items_unique unique (payroll_run_id, staff_id)
);

comment on table public.payroll_items is
  'Frozen payslip line: (payable units x daily wage) + overtime + additions - deductions - advance recovery.';

-- ---------------------------------------------------------------------------------
--  6.2  Advances & loans ledger
-- ---------------------------------------------------------------------------------
create table if not exists public.staff_advances (
  id                 uuid primary key default gen_random_uuid(),
  staff_id           uuid not null references public.staff(id) on delete restrict,
  advance_type       public.advance_type not null default 'advance',
  issued_on          date not null default current_date,
  amount             public.money_inr not null check (amount > 0),
  reason             text,
  recovery_per_cycle public.money_inr not null default 0,   -- INR deducted each payroll month
  recovered_amount   numeric(12,2) not null default 0 check (recovered_amount >= 0),

  balance_amount numeric(12,2) generated always as (amount - recovered_amount) stored,

  status             public.advance_status not null default 'open',
  payment_mode       public.payment_mode not null default 'cash',
  payment_reference  text,
  approved_by        uuid references public.profiles(id) on delete set null,
  notes              text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint staff_advances_recovered_chk check (recovered_amount <= amount)
);

comment on column public.staff_advances.recovery_per_cycle is
  'Instalment recovered per monthly payroll. 0 means recover in full at the next payroll.';
comment on column public.staff_advances.balance_amount is
  'Generated. Outstanding = amount - recovered_amount. Kept in sync by trg_advance_recovery_sync.';

create table if not exists public.advance_recoveries (
  id              uuid primary key default gen_random_uuid(),
  advance_id      uuid not null references public.staff_advances(id) on delete cascade,
  payroll_item_id uuid references public.payroll_items(id) on delete set null,
  recovery_date   date not null default current_date,
  amount          public.money_inr not null check (amount > 0),
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------
--  6.3  Payroll adjustments — anything that is not attendance-driven.
-- ---------------------------------------------------------------------------------
create table if not exists public.payroll_adjustments (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references public.staff(id) on delete cascade,
  period_month date not null,
  kind         public.adjustment_kind not null,
  category     text not null,                       -- 'diwali_bonus', 'uniform', 'pf_employee', ...
  amount       public.money_inr not null check (amount > 0),
  notes        text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint payroll_adj_month_chk check (period_month = public.month_of(period_month))
);

-- ---------------------------------------------------------------------------------
--  6.4  Patient invoices
--
--  GST NOTE (India): services by a clinical establishment are exempt under
--  Notification 12/2017-CT(R). Most home-nursing agencies invoice exempt and set
--  is_gst_exempt = true; if your CA has taken a different view, set the rates and
--  the amounts fill themselves in (trg_invoice_tax). SAC 9993x — confirm the exact
--  sub-code with your CA before your first filing.
-- ---------------------------------------------------------------------------------
create table if not exists public.patient_invoices (
  id                uuid primary key default gen_random_uuid(),
  invoice_number    text not null unique default public.fn_next_invoice_number(),
  patient_id        uuid not null references public.patients(id) on delete restrict,
  period_month      date,
  period_start      date,
  period_end        date,
  invoice_date      date not null default current_date,
  due_date          date,

  -- Statutory fields
  place_of_supply   text not null default '27-Maharashtra',
  supplier_gstin    public.gstin,
  customer_gstin    public.gstin,
  is_gst_exempt     boolean not null default true,
  gst_exemption_reason text default 'Exempt healthcare services - Notification 12/2017-CT(R)',

  subtotal          numeric(12,2) not null default 0,
  discount_amount   numeric(12,2) not null default 0 check (discount_amount >= 0),
  taxable_value     numeric(12,2) not null default 0,
  cgst_rate         numeric(5,2)  not null default 0 check (cgst_rate between 0 and 50),
  cgst_amount       numeric(12,2) not null default 0,
  sgst_rate         numeric(5,2)  not null default 0 check (sgst_rate between 0 and 50),
  sgst_amount       numeric(12,2) not null default 0,
  igst_rate         numeric(5,2)  not null default 0 check (igst_rate between 0 and 50),
  igst_amount       numeric(12,2) not null default 0,
  tds_rate          numeric(5,2)  not null default 0 check (tds_rate between 0 and 30),
  tds_amount        numeric(12,2) not null default 0,

  advance_adjusted  numeric(12,2) not null default 0 check (advance_adjusted >= 0),
  amount_paid       numeric(12,2) not null default 0 check (amount_paid >= 0),

  total_amount   numeric(12,2) generated always as
    (taxable_value + cgst_amount + sgst_amount + igst_amount) stored,
  net_receivable numeric(12,2) generated always as
    (taxable_value + cgst_amount + sgst_amount + igst_amount - tds_amount - advance_adjusted) stored,
  balance_due    numeric(12,2) generated always as
    (taxable_value + cgst_amount + sgst_amount + igst_amount - tds_amount - advance_adjusted - amount_paid) stored,

  status            public.invoice_status not null default 'draft',
  issued_at         timestamptz,
  notes             text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint invoice_period_chk check (period_end is null or period_start is null or period_end >= period_start),
  constraint invoice_due_chk    check (due_date is null or due_date >= invoice_date),
  constraint invoice_month_unique unique (patient_id, period_month)
);

create table if not exists public.patient_invoice_lines (
  id                 uuid primary key default gen_random_uuid(),
  invoice_id         uuid not null references public.patient_invoices(id) on delete cascade,
  duty_allocation_id uuid references public.duty_allocations(id) on delete set null,
  description        text not null,
  hsn_sac            text not null default '999319',
  quantity           numeric(8,2) not null default 1 check (quantity >= 0),
  uom                text not null default 'DAY',
  rate               numeric(12,2) not null default 0,
  amount numeric(12,2) generated always as (quantity * rate) stored,
  sort_order         smallint not null default 1,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------
--  6.5  Patient receipts — advances and payments against invoices.
--  The patient's "advance received" and "outstanding balance" are DERIVED from this
--  ledger (see v_patient_account_summary / v_patient_master), never typed by hand.
-- ---------------------------------------------------------------------------------
create table if not exists public.patient_payments (
  id             uuid primary key default gen_random_uuid(),
  receipt_number text not null unique default public.fn_next_receipt_number(),
  patient_id     uuid not null references public.patients(id) on delete restrict,
  invoice_id     uuid references public.patient_invoices(id) on delete set null,
  direction      public.payment_direction not null default 'against_invoice',
  received_on    date not null default current_date,
  amount         public.money_inr not null check (amount > 0),
  payment_mode   public.payment_mode not null default 'upi',
  reference      text,
  received_by    uuid references public.profiles(id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------
--  6.6  Operating expenses — the "other costs" leg of the margin calculation.
--  Attribute to a patient/allocation where you can; leave null for agency overhead.
-- ---------------------------------------------------------------------------------
create table if not exists public.operating_expenses (
  id                 uuid primary key default gen_random_uuid(),
  expense_date       date not null default current_date,
  category           public.expense_category not null,
  description        text,
  amount             public.money_inr not null check (amount > 0),
  patient_id         uuid references public.patients(id) on delete set null,
  staff_id           uuid references public.staff(id) on delete set null,
  duty_allocation_id uuid references public.duty_allocations(id) on delete set null,
  paid_to            text,
  payment_mode       public.payment_mode not null default 'cash',
  reference          text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- =====================================================================================
--  SECTION 07 — TRIGGERS
-- =====================================================================================

-- 7.1  updated_at on every table that declares the column ------------------------
do $$
declare t text;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at' and a.attnum > 0
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I', t);
    execute format(
      'create trigger trg_set_updated_at before update on public.%I
       for each row execute function public.fn_set_updated_at()', t);
  end loop;
end $$;

-- NOTE ON security definer BELOW: these triggers must read duty_allocations,
-- payroll_runs and patient_invoices to do their job. An attendant cannot SELECT
-- those tables under RLS, so as INVOKER the trigger would see nothing and the
-- guard would quietly not fire. They only read; the row being written is still
-- subject to the caller's RLS WITH CHECK.

-- 7.2  Attendance: inherit the allocation, snapshot the rates ---------------------
create or replace function public.fn_attendance_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.duty_allocations where id = new.duty_allocation_id;
  if not found then
    raise exception 'Duty allocation % does not exist', new.duty_allocation_id;
  end if;

  new.patient_id := a.patient_id;
  new.staff_id   := coalesce(new.staff_id, a.staff_id);
  new.shift_slot := a.shift_slot;

  if new.staff_id <> a.staff_id and not new.is_replacement then
    raise exception
      'Attendant % is not the one posted on this allocation (%). Mark is_replacement = true for a relief duty.',
      new.staff_id, a.staff_id;
  end if;

  if new.duty_date < a.start_date
     or (a.end_date is not null and new.duty_date > a.end_date) then
    raise exception 'Duty date % is outside the allocation window % .. %',
      new.duty_date, a.start_date, coalesce(a.end_date::text, 'open');
  end if;

  if tg_op = 'INSERT' then
    -- A relief duty is paid to the relief attendant but billed on the original
    -- 'replaced' row, so the patient is never charged twice for the same day.
    if new.is_replacement then
      new.is_billable := false;
    end if;

    if new.patient_rate_applied = 0 then
      new.patient_rate_applied := a.patient_daily_rate;
    end if;
    if new.staff_wage_applied = 0 then
      new.staff_wage_applied := coalesce(
        (select s.default_daily_wage from public.staff s
          where new.is_replacement and s.id = new.staff_id),
        a.staff_daily_wage);
    end if;
    if new.ot_hourly_rate_applied = 0 then
      new.ot_hourly_rate_applied := a.ot_hourly_rate;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_attendance_defaults on public.attendance;
create trigger trg_attendance_defaults
  before insert or update on public.attendance
  for each row execute function public.fn_attendance_defaults();

-- 7.3  Attendance: refuse to touch a settled month --------------------------------
create or replace function public.fn_guard_locked_period()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_date    date;
  v_patient uuid;
  v_month   date;
begin
  if tg_op = 'DELETE' then
    v_date := old.duty_date;  v_patient := old.patient_id;
  else
    v_date := new.duty_date;  v_patient := new.patient_id;
  end if;
  v_month := public.month_of(v_date);

  if exists (select 1 from public.payroll_runs r
              where r.period_month = v_month and r.status in ('approved','paid')) then
    raise exception 'Payroll for % is locked. Reopen the payroll run before editing attendance.',
      to_char(v_month, 'Mon YYYY') using errcode = '23514';
  end if;

  if exists (select 1 from public.patient_invoices i
              where i.patient_id = v_patient
                and i.period_month = v_month
                and i.status in ('issued','partially_paid','paid')) then
    raise exception 'The % invoice for this patient is already issued. Cancel or credit-note it first.',
      to_char(v_month, 'Mon YYYY') using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists trg_attendance_period_lock on public.attendance;
create trigger trg_attendance_period_lock
  before insert or update or delete on public.attendance
  for each row execute function public.fn_guard_locked_period();

-- 7.4  Attendance: an attendant may punch in/out, not rewrite their own pay -------
create or replace function public.fn_attendance_field_guard()
returns trigger language plpgsql as $$
begin
  if public.is_back_office() or public.is_service_context() then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.patient_rate_applied  is distinct from old.patient_rate_applied
     or new.staff_wage_applied    is distinct from old.staff_wage_applied
     or new.ot_hourly_rate_applied is distinct from old.ot_hourly_rate_applied
     or new.overtime_hours        is distinct from old.overtime_hours
     or new.is_billable           is distinct from old.is_billable
     or new.duty_date             is distinct from old.duty_date
     or new.verified_by           is distinct from old.verified_by then
    raise exception 'Attendants may only record check-in, check-out and notes. Ask a coordinator to amend this duty.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_attendance_field_guard on public.attendance;
create trigger trg_attendance_field_guard
  before update on public.attendance
  for each row execute function public.fn_attendance_field_guard();

-- 7.5  Advances: keep recovered_amount and status in step with the ledger ---------
create or replace function public.fn_advance_recovery_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_advance uuid := coalesce(new.advance_id, old.advance_id);
begin
  update public.staff_advances a
     set recovered_amount = coalesce(
           (select sum(r.amount) from public.advance_recoveries r where r.advance_id = a.id), 0)
   where a.id = v_advance;

  update public.staff_advances a
     set status = (case when a.balance_amount <= 0 then 'closed' else 'open' end)::public.advance_status
   where a.id = v_advance
     and a.status <> 'written_off';

  return null;
end $$;

drop trigger if exists trg_advance_recovery_sync on public.advance_recoveries;
create trigger trg_advance_recovery_sync
  after insert or update or delete on public.advance_recoveries
  for each row execute function public.fn_advance_recovery_sync();

-- 7.6  Invoices: derive taxable value and tax amounts from the rates -------------
create or replace function public.fn_invoice_totals()
returns trigger language plpgsql as $$
begin
  new.taxable_value := round(greatest(new.subtotal - new.discount_amount, 0), 2);

  if new.is_gst_exempt then
    new.cgst_rate := 0; new.sgst_rate := 0; new.igst_rate := 0;
  end if;

  new.cgst_amount := round(new.taxable_value * new.cgst_rate / 100.0, 2);
  new.sgst_amount := round(new.taxable_value * new.sgst_rate / 100.0, 2);
  new.igst_amount := round(new.taxable_value * new.igst_rate / 100.0, 2);
  new.tds_amount  := round(new.taxable_value * new.tds_rate  / 100.0, 2);

  if new.status in ('issued','partially_paid','paid') and new.issued_at is null then
    new.issued_at := now();
  end if;
  if new.due_date is null then
    new.due_date := new.invoice_date + 7;
  end if;
  return new;
end $$;

drop trigger if exists trg_invoice_totals on public.patient_invoices;
create trigger trg_invoice_totals
  before insert or update on public.patient_invoices
  for each row execute function public.fn_invoice_totals();

create or replace function public.fn_invoice_recalc_lines()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update public.patient_invoices i
     set subtotal = coalesce(
           (select sum(l.amount) from public.patient_invoice_lines l where l.invoice_id = i.id), 0)
   where i.id = v_invoice;
  return null;
end $$;

drop trigger if exists trg_invoice_recalc_lines on public.patient_invoice_lines;
create trigger trg_invoice_recalc_lines
  after insert or update or delete on public.patient_invoice_lines
  for each row execute function public.fn_invoice_recalc_lines();

-- 7.7  Receipts: post payments onto the invoice ----------------------------------
create or replace function public.fn_invoice_payment_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  if v_invoice is null then
    return null;
  end if;

  update public.patient_invoices i
     set amount_paid = coalesce(
           (select sum(p.amount) from public.patient_payments p where p.invoice_id = i.id), 0)
   where i.id = v_invoice;

  update public.patient_invoices i
     set status = (case
                    when i.status in ('draft','cancelled','written_off') then i.status::text
                    when i.balance_due <= 0    then 'paid'
                    when i.amount_paid > 0     then 'partially_paid'
                    else 'issued'
                  end)::public.invoice_status
   where i.id = v_invoice;

  return null;
end $$;

drop trigger if exists trg_invoice_payment_sync on public.patient_payments;
create trigger trg_invoice_payment_sync
  after insert or update or delete on public.patient_payments
  for each row execute function public.fn_invoice_payment_sync();

-- 7.8  Audit trail on the tables people argue about -------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'duty_allocations','attendance','staff_advances','advance_recoveries',
    'payroll_runs','payroll_items','patient_invoices','patient_payments',
    'staff_bank_accounts','staff_kyc','payroll_adjustments'
  ] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format(
      'create trigger trg_audit after insert or update or delete on public.%I
       for each row execute function public.fn_audit()', t);
  end loop;
end $$;

-- =====================================================================================
--  SECTION 08 — INDEXES
--  Postgres indexes a primary key and a unique constraint for you; it does NOT index
--  foreign keys. Everything below is a query the app actually runs.
-- =====================================================================================

-- Patients -------------------------------------------------------------------------
create index if not exists idx_patients_status        on public.patients (status) where status = 'active';
create index if not exists idx_patients_service_type  on public.patients (service_type);
create index if not exists idx_patients_start_date    on public.patients (start_date desc);
create index if not exists idx_patients_phone         on public.patients (primary_contact_phone);
create index if not exists idx_patients_area          on public.patients (city, area);
create index if not exists idx_patients_name_trgm     on public.patients using gin (full_name gin_trgm_ops);
create index if not exists idx_patients_ref_doctor    on public.patients (referring_doctor_id);
create index if not exists idx_patients_treat_doctor  on public.patients (treating_doctor_id);

-- Staff ----------------------------------------------------------------------------
create index if not exists idx_staff_active           on public.staff (is_active) where is_active;
create index if not exists idx_staff_category         on public.staff (category, is_active);
create index if not exists idx_staff_phone            on public.staff (phone);
create index if not exists idx_staff_name_trgm        on public.staff using gin (full_name gin_trgm_ops);
create index if not exists idx_staff_docs_staff       on public.staff_documents (staff_id, doc_type);
create index if not exists idx_staff_docs_expiry      on public.staff_documents (expires_on) where expires_on is not null;
create index if not exists idx_staff_bank_staff       on public.staff_bank_accounts (staff_id);

-- Duty allocations ------------------------------------------------------------------
create index if not exists idx_alloc_patient          on public.duty_allocations (patient_id, status);
create index if not exists idx_alloc_staff            on public.duty_allocations (staff_id, status);
create index if not exists idx_alloc_ongoing          on public.duty_allocations (start_date desc) where status = 'ongoing';
create index if not exists idx_alloc_window           on public.duty_allocations (start_date, end_date);

-- Attendance (the hot table: every payroll and every invoice scans it) --------------
create index if not exists idx_att_alloc_date         on public.attendance (duty_allocation_id, duty_date desc);
create index if not exists idx_att_staff_date         on public.attendance (staff_id, duty_date desc);
create index if not exists idx_att_patient_date       on public.attendance (patient_id, duty_date desc);
create index if not exists idx_att_date               on public.attendance (duty_date desc);
create index if not exists idx_att_status             on public.attendance (status, duty_date desc);
create index if not exists idx_att_open_shifts        on public.attendance (duty_date) where check_out_at is null;
create index if not exists idx_att_unverified         on public.attendance (duty_date desc) where verified_at is null;
-- Month-bucket index: matches the date_trunc used by every settlement view.
create index if not exists idx_att_staff_month        on public.attendance (staff_id, (public.month_of(duty_date)));
create index if not exists idx_att_patient_month      on public.attendance (patient_id, (public.month_of(duty_date)));

-- Leave ------------------------------------------------------------------------------
create index if not exists idx_leave_staff            on public.leave_requests (staff_id, from_date desc);
create index if not exists idx_leave_pending          on public.leave_requests (from_date) where status = 'pending';

-- Money -------------------------------------------------------------------------------
create index if not exists idx_adv_staff              on public.staff_advances (staff_id, status);
create index if not exists idx_adv_open               on public.staff_advances (staff_id) where status = 'open';
create index if not exists idx_adv_rec_advance        on public.advance_recoveries (advance_id, recovery_date desc);
create index if not exists idx_adv_rec_item           on public.advance_recoveries (payroll_item_id);
create index if not exists idx_adj_staff_month        on public.payroll_adjustments (staff_id, period_month);

create index if not exists idx_pay_items_run          on public.payroll_items (payroll_run_id);
create index if not exists idx_pay_items_staff        on public.payroll_items (staff_id, period_month desc);
create index if not exists idx_pay_items_unpaid       on public.payroll_items (period_month desc) where payment_status <> 'paid';
create index if not exists idx_payroll_runs_month     on public.payroll_runs (period_month desc);

create index if not exists idx_inv_patient            on public.patient_invoices (patient_id, period_month desc);
create index if not exists idx_inv_status             on public.patient_invoices (status, invoice_date desc);
create index if not exists idx_inv_outstanding        on public.patient_invoices (due_date) where status in ('issued','partially_paid');
create index if not exists idx_inv_lines_invoice      on public.patient_invoice_lines (invoice_id, sort_order);

create index if not exists idx_pay_patient            on public.patient_payments (patient_id, received_on desc);
create index if not exists idx_pay_invoice            on public.patient_payments (invoice_id);
create index if not exists idx_pay_month              on public.patient_payments ((public.month_of(received_on)));

create index if not exists idx_exp_date               on public.operating_expenses (expense_date desc);
create index if not exists idx_exp_patient            on public.operating_expenses (patient_id, expense_date desc);
create index if not exists idx_exp_category           on public.operating_expenses (category, expense_date desc);
create index if not exists idx_exp_month              on public.operating_expenses ((public.month_of(expense_date)));

-- Identity & audit ---------------------------------------------------------------------
create index if not exists idx_profiles_role          on public.profiles (role) where is_active;
create index if not exists idx_profiles_staff         on public.profiles (staff_id);
create index if not exists idx_audit_table_record     on public.audit_log (table_name, record_id, changed_at desc);
create index if not exists idx_audit_actor            on public.audit_log (actor_id, changed_at desc);

-- =====================================================================================
--  SECTION 09 — REPORTING VIEWS
--
--  All views are created WITH (security_invoker = on) so they honour the caller's RLS
--  instead of the view owner's. Without it a view is a hole straight through your
--  policies. (Requires PostgreSQL 15+, which every current Supabase project runs.)
-- =====================================================================================

drop view if exists public.v_agency_monthly_pnl            cascade;
drop view if exists public.v_patient_profitability_monthly cascade;
drop view if exists public.v_patient_master                cascade;
drop view if exists public.v_patient_account_summary       cascade;
drop view if exists public.v_patient_monthly_billing       cascade;
drop view if exists public.v_staff_monthly_salary          cascade;
drop view if exists public.v_staff_advance_balances        cascade;
drop view if exists public.v_staff_payslips                cascade;
drop view if exists public.v_daily_roster                  cascade;
drop view if exists public.v_attendance_detail             cascade;
drop view if exists public.v_duty_allocation_summary       cascade;

-- ---------------------------------------------------------------------------------
--  9.1  Attendance, resolved: names, money and a GPS sanity check on every row.
-- ---------------------------------------------------------------------------------
create view public.v_attendance_detail with (security_invoker = on) as
select
  a.id,
  a.duty_date,
  public.month_of(a.duty_date)          as period_month,
  a.duty_allocation_id,
  a.patient_id,
  p.patient_code,
  p.full_name                                     as patient_name,
  p.area                                          as patient_area,
  a.staff_id,
  s.staff_code,
  s.full_name                                     as staff_name,
  s.category                                      as staff_category,
  a.shift_slot,
  al.duty_type,
  a.status,
  a.is_replacement,
  a.is_billable,
  a.check_in_at,
  a.check_out_at,
  round(extract(epoch from (a.check_out_at - a.check_in_at)) / 3600.0, 2) as hours_on_duty,
  a.overtime_hours,

  -- Money
  a.patient_units,
  a.patient_rate_applied,
  round(a.patient_units * a.patient_rate_applied, 2)                          as billed_amount,
  a.staff_units,
  a.staff_wage_applied,
  round(a.staff_units * a.staff_wage_applied, 2)                              as wage_amount,
  round(a.overtime_hours * a.ot_hourly_rate_applied, 2)                       as overtime_amount,
  round(a.staff_units * a.staff_wage_applied
      + a.overtime_hours * a.ot_hourly_rate_applied, 2)                       as total_staff_cost,
  round(a.patient_units * a.patient_rate_applied
      - a.staff_units * a.staff_wage_applied
      - a.overtime_hours * a.ot_hourly_rate_applied, 2)                       as day_contribution,

  -- GPS verification against the patient's registered address
  a.check_in_lat, a.check_in_lng, a.check_out_lat, a.check_out_lng,
  public.fn_haversine_meters(a.check_in_lat,  a.check_in_lng,  p.latitude, p.longitude) as check_in_distance_m,
  public.fn_haversine_meters(a.check_out_lat, a.check_out_lng, p.latitude, p.longitude) as check_out_distance_m,
  case
    when a.check_in_lat is null or p.latitude is null then null
    else public.fn_haversine_meters(a.check_in_lat, a.check_in_lng, p.latitude, p.longitude)
         <= p.geofence_radius_m
  end                                                                          as check_in_on_site,
  a.verified_at is not null                                                    as is_verified,
  a.notes
from public.attendance a
join public.patients          p  on p.id  = a.patient_id
join public.staff             s  on s.id  = a.staff_id
join public.duty_allocations  al on al.id = a.duty_allocation_id;

comment on view public.v_attendance_detail is
  'Row-level duty ledger: revenue, cost and contribution per duty, plus a geo-fence check on the check-in.';

-- ---------------------------------------------------------------------------------
--  9.2  Today's board: every ongoing duty and whether it has been marked.
-- ---------------------------------------------------------------------------------
create view public.v_daily_roster with (security_invoker = on) as
select
  d::date                                as duty_date,
  al.id                                  as duty_allocation_id,
  al.patient_id, p.full_name             as patient_name,
  p.address_line1, p.area, p.primary_contact_phone,
  al.staff_id,   s.full_name             as staff_name, s.phone as staff_phone,
  al.duty_type,  al.shift_slot,
  al.patient_daily_rate, al.staff_daily_wage,
  a.id                                   as attendance_id,
  a.status                               as attendance_status,
  a.check_in_at, a.check_out_at,
  (a.id is null)                         as is_unmarked
from generate_series(current_date - 7, current_date, interval '1 day') d
join public.duty_allocations al
     on al.status = 'ongoing'
    and d::date between al.start_date and coalesce(al.end_date, date '9999-12-31')
join public.patients p on p.id = al.patient_id
join public.staff    s on s.id = al.staff_id
left join public.attendance a
     on a.duty_allocation_id = al.id
    and a.duty_date = d::date
    and a.staff_id  = al.staff_id;

comment on view public.v_daily_roster is
  'Last 7 days of scheduled duties with their attendance row, if any. is_unmarked drives the "mark attendance" queue.';

-- ---------------------------------------------------------------------------------
--  9.3  Allocation summary
-- ---------------------------------------------------------------------------------
create view public.v_duty_allocation_summary with (security_invoker = on) as
select
  al.id, al.patient_id, p.full_name as patient_name,
  al.staff_id, s.full_name as staff_name, s.category as staff_category,
  al.duty_type, al.shift_slot, al.status,
  al.start_date, al.end_date,
  al.patient_daily_rate, al.staff_daily_wage,
  al.patient_daily_rate - al.staff_daily_wage                        as daily_margin,
  case when al.patient_daily_rate > 0
       then round((al.patient_daily_rate - al.staff_daily_wage) * 100.0 / al.patient_daily_rate, 2)
  end                                                                as daily_margin_pct,
  coalesce(sum(a.patient_units), 0)                                  as billable_units,
  coalesce(sum(a.staff_units), 0)                                    as payable_units,
  coalesce(sum(a.patient_units * a.patient_rate_applied), 0)         as revenue_to_date,
  coalesce(sum(a.staff_units * a.staff_wage_applied
             + a.overtime_hours * a.ot_hourly_rate_applied), 0)      as cost_to_date,
  coalesce(sum(a.patient_units * a.patient_rate_applied), 0)
    - coalesce(sum(a.staff_units * a.staff_wage_applied
                 + a.overtime_hours * a.ot_hourly_rate_applied), 0)  as contribution_to_date,
  max(a.duty_date)                                                   as last_duty_date
from public.duty_allocations al
join public.patients p on p.id = al.patient_id
join public.staff    s on s.id = al.staff_id
left join public.attendance a on a.duty_allocation_id = al.id
group by al.id, p.full_name, s.full_name, s.category;

-- ---------------------------------------------------------------------------------
--  9.4  Advances outstanding, and what the next payroll should recover.
-- ---------------------------------------------------------------------------------
create view public.v_staff_advance_balances with (security_invoker = on) as
select
  adv.id                as advance_id,
  adv.staff_id,
  s.staff_code,
  s.full_name           as staff_name,
  adv.advance_type,
  adv.issued_on,
  adv.amount,
  adv.recovered_amount,
  adv.balance_amount,
  adv.recovery_per_cycle,
  adv.status,
  adv.reason,
  -- 0 recovery_per_cycle means "take the whole balance next payroll"
  case when adv.status <> 'open' then 0
       when adv.recovery_per_cycle = 0 then adv.balance_amount
       else least(adv.recovery_per_cycle, adv.balance_amount)
  end                   as next_cycle_recovery,
  (select max(r.recovery_date) from public.advance_recoveries r where r.advance_id = adv.id)
                        as last_recovery_date
from public.staff_advances adv
join public.staff s on s.id = adv.staff_id;

comment on view public.v_staff_advance_balances is
  'Per-advance outstanding balance and the instalment the next payroll run will deduct.';

-- ---------------------------------------------------------------------------------
--  9.5  ATTENDANT MONTHLY SALARY (live)
--       (duties present x daily rate) + overtime + additions
--       - other deductions - advance recovery = net payable
-- ---------------------------------------------------------------------------------
create view public.v_staff_monthly_salary with (security_invoker = on) as
with att as (
  select
    a.staff_id,
    public.month_of(a.duty_date)                             as period_month,
    count(*) filter (where a.status = 'present')                       as days_present,
    count(*) filter (where a.status = 'half_day')                      as half_days,
    count(*) filter (where a.status = 'absent')                        as days_absent,
    count(*) filter (where a.status = 'paid_leave')                    as paid_leave_days,
    count(*) filter (where a.status = 'unpaid_leave')                  as unpaid_leave_days,
    count(*) filter (where a.status = 'week_off')                      as week_offs,
    count(*) filter (where a.is_replacement)                           as replacement_duties,
    count(distinct a.patient_id)                                       as patients_served,
    coalesce(sum(a.staff_units), 0)                                    as payable_units,
    coalesce(sum(a.overtime_hours), 0)                                 as overtime_hours,
    coalesce(sum(a.staff_units * a.staff_wage_applied), 0)             as gross_wage,
    coalesce(sum(a.overtime_hours * a.ot_hourly_rate_applied), 0)      as overtime_amount
  from public.attendance a
  group by 1, 2
),
adj as (
  select
    staff_id,
    period_month,
    coalesce(sum(amount) filter (where kind = 'addition'),  0) as additions,
    coalesce(sum(amount) filter (where kind = 'deduction'), 0) as other_deductions
  from public.payroll_adjustments
  group by 1, 2
),
rec as (
  select
    adv.staff_id,
    public.month_of(r.recovery_date) as period_month,
    sum(r.amount)                              as advance_recovered
  from public.advance_recoveries r
  join public.staff_advances adv on adv.id = r.advance_id
  group by 1, 2
),
periods as (
  select staff_id, period_month from att
  union
  select staff_id, period_month from adj
  union
  select staff_id, period_month from rec
)
select
  pr.staff_id,
  s.staff_code,
  s.full_name                            as staff_name,
  s.category,
  pr.period_month,
  to_char(pr.period_month, 'Mon YYYY')   as period_label,
  coalesce(att.days_present, 0)          as days_present,
  coalesce(att.half_days, 0)             as half_days,
  coalesce(att.days_absent, 0)           as days_absent,
  coalesce(att.paid_leave_days, 0)       as paid_leave_days,
  coalesce(att.unpaid_leave_days, 0)     as unpaid_leave_days,
  coalesce(att.week_offs, 0)             as week_offs,
  coalesce(att.replacement_duties, 0)    as replacement_duties,
  coalesce(att.patients_served, 0)       as patients_served,
  coalesce(att.payable_units, 0)         as payable_units,
  coalesce(att.overtime_hours, 0)        as overtime_hours,
  round(coalesce(att.gross_wage, 0), 2)      as gross_wage,
  round(coalesce(att.overtime_amount, 0), 2) as overtime_amount,
  round(coalesce(adj.additions, 0), 2)       as additions,
  round(coalesce(adj.other_deductions, 0), 2) as other_deductions,
  round(coalesce(rec.advance_recovered, 0), 2) as advance_recovered,
  round(
      coalesce(att.gross_wage, 0)
    + coalesce(att.overtime_amount, 0)
    + coalesce(adj.additions, 0)
    - coalesce(adj.other_deductions, 0)
    - coalesce(rec.advance_recovered, 0), 2)   as net_payable
from periods pr
join public.staff s on s.id = pr.staff_id
left join att on att.staff_id = pr.staff_id and att.period_month = pr.period_month
left join adj on adj.staff_id = pr.staff_id and adj.period_month = pr.period_month
left join rec on rec.staff_id = pr.staff_id and rec.period_month = pr.period_month;

comment on view public.v_staff_monthly_salary is
  'Live monthly salary: (present duties x daily wage) + OT + additions - deductions - advance recovery.';

-- ---------------------------------------------------------------------------------
--  9.6  Frozen payslips (what was actually approved and paid)
-- ---------------------------------------------------------------------------------
create view public.v_staff_payslips with (security_invoker = on) as
select
  pi.id                                 as payroll_item_id,
  r.id                                  as payroll_run_id,
  r.period_month,
  to_char(r.period_month, 'Mon YYYY')   as period_label,
  r.status                              as run_status,
  pi.staff_id, s.staff_code, s.full_name as staff_name, s.category,
  pi.days_present, pi.half_days, pi.days_absent, pi.paid_leave_days,
  pi.payable_units, pi.overtime_hours,
  pi.gross_wage, pi.overtime_amount, pi.additions, pi.other_deductions,
  pi.advance_recovery, pi.net_payable,
  pi.payment_status, pi.paid_amount, pi.paid_at, pi.payment_mode, pi.payment_reference,
  b.account_number, b.ifsc_code, b.bank_name, b.account_holder_name
from public.payroll_items pi
join public.payroll_runs r on r.id = pi.payroll_run_id
join public.staff s        on s.id = pi.staff_id
left join public.staff_bank_accounts b on b.staff_id = pi.staff_id and b.is_primary;

-- ---------------------------------------------------------------------------------
--  9.7  PATIENT MONTHLY BILL (live)
--       (fulfilled duties x daily rate) - advances - payments received,
--       carried forward month to month.
-- ---------------------------------------------------------------------------------
create view public.v_patient_monthly_billing with (security_invoker = on) as
with bill as (
  select
    a.patient_id,
    public.month_of(a.duty_date)                    as period_month,
    coalesce(sum(a.patient_units), 0)                         as billable_units,
    count(*) filter (where a.patient_units > 0)               as duties_billed,
    count(*) filter (where a.status = 'absent')               as duties_missed,
    coalesce(sum(a.patient_units * a.patient_rate_applied), 0) as billed_amount
  from public.attendance a
  group by 1, 2
),
pay as (
  select
    p.patient_id,
    public.month_of(p.received_on) as period_month,
    coalesce(sum(p.amount) filter (where p.direction = 'advance'), 0)          as advances_received,
    coalesce(sum(p.amount) filter (where p.direction = 'against_invoice'), 0)  as payments_received,
    coalesce(sum(p.amount) filter (where p.direction = 'security_deposit'), 0) as deposits_received,
    coalesce(sum(p.amount) filter (where p.direction = 'refund'), 0)           as refunds_paid
  from public.patient_payments p
  group by 1, 2
),
periods as (
  select patient_id, period_month from bill
  union
  select patient_id, period_month from pay
),
merged as (
  select
    pr.patient_id,
    pr.period_month,
    coalesce(b.billable_units, 0)     as billable_units,
    coalesce(b.duties_billed, 0)      as duties_billed,
    coalesce(b.duties_missed, 0)      as duties_missed,
    coalesce(b.billed_amount, 0)      as billed_amount,
    coalesce(p.advances_received, 0)  as advances_received,
    coalesce(p.payments_received, 0)  as payments_received,
    coalesce(p.deposits_received, 0)  as deposits_received,
    coalesce(p.refunds_paid, 0)       as refunds_paid,
    coalesce(p.advances_received, 0) + coalesce(p.payments_received, 0)
      - coalesce(p.refunds_paid, 0)   as collections_applied
  from periods pr
  left join bill b on b.patient_id = pr.patient_id and b.period_month = pr.period_month
  left join pay  p on p.patient_id = pr.patient_id and p.period_month = pr.period_month
)
select
  m.patient_id,
  pt.patient_code,
  pt.full_name                          as patient_name,
  pt.service_type,
  m.period_month,
  to_char(m.period_month, 'Mon YYYY')   as period_label,
  m.billable_units,
  m.duties_billed,
  m.duties_missed,
  round(m.billed_amount, 2)             as billed_amount,
  round(m.advances_received, 2)         as advances_received,
  round(m.payments_received, 2)         as payments_received,
  round(m.deposits_received, 2)         as deposits_received,
  round(m.refunds_paid, 2)              as refunds_paid,
  round(m.collections_applied, 2)       as collections_applied,
  round(coalesce(sum(m.billed_amount - m.collections_applied)
        over (partition by m.patient_id order by m.period_month
              rows between unbounded preceding and 1 preceding), 0), 2) as opening_balance,
  round(coalesce(sum(m.billed_amount - m.collections_applied)
        over (partition by m.patient_id order by m.period_month
              rows between unbounded preceding and 1 preceding), 0)
        + m.billed_amount - m.collections_applied, 2)                   as closing_balance
from merged m
join public.patients pt on pt.id = m.patient_id;

comment on view public.v_patient_monthly_billing is
  'Live monthly statement per patient: duties billed, collections, and carried-forward balance.';

-- ---------------------------------------------------------------------------------
--  9.8  Patient account summary (lifetime advance / outstanding)
-- ---------------------------------------------------------------------------------
create view public.v_patient_account_summary with (security_invoker = on) as
select
  pt.id                                            as patient_id,
  coalesce(b.total_billed, 0)                      as total_billed,
  coalesce(c.total_advances, 0)                    as advance_received,
  coalesce(c.total_payments, 0)                    as payments_received,
  coalesce(c.total_deposits, 0)                    as security_deposit_held,
  coalesce(c.total_refunds, 0)                     as refunds_paid,
  round(coalesce(b.total_billed, 0)
      - coalesce(c.total_advances, 0)
      - coalesce(c.total_payments, 0)
      + coalesce(c.total_refunds, 0), 2)           as outstanding_balance,
  b.last_duty_date,
  c.last_payment_date
from public.patients pt
left join (
  select patient_id,
         sum(patient_units * patient_rate_applied) as total_billed,
         max(duty_date)                            as last_duty_date
  from public.attendance group by patient_id
) b on b.patient_id = pt.id
left join (
  select patient_id,
         sum(amount) filter (where direction = 'advance')          as total_advances,
         sum(amount) filter (where direction = 'against_invoice')  as total_payments,
         sum(amount) filter (where direction = 'security_deposit') as total_deposits,
         sum(amount) filter (where direction = 'refund')           as total_refunds,
         max(received_on)                                          as last_payment_date
  from public.patient_payments group by patient_id
) c on c.patient_id = pt.id;

-- ---------------------------------------------------------------------------------
--  9.9  Patient master as the UI wants it: the record plus its live balances.
--       Select from this instead of public.patients on list and detail screens.
-- ---------------------------------------------------------------------------------
create view public.v_patient_master with (security_invoker = on) as
select
  p.*,
  coalesce(p.age_years, extract(year from age(current_date, p.date_of_birth))::smallint) as age,
  rd.full_name  as referring_doctor_name,
  rd.phone      as referring_doctor_phone,
  td.full_name  as treating_doctor_name,
  acc.total_billed,
  acc.advance_received,
  acc.payments_received,
  acc.security_deposit_held,
  acc.outstanding_balance,
  acc.last_duty_date,
  acc.last_payment_date,
  (select count(*) from public.duty_allocations al
    where al.patient_id = p.id and al.status = 'ongoing')          as active_allocations,
  (select string_agg(s.full_name, ', ' order by s.full_name)
     from public.duty_allocations al
     join public.staff s on s.id = al.staff_id
    where al.patient_id = p.id and al.status = 'ongoing')          as current_attendants
from public.patients p
left join public.doctors rd on rd.id = p.referring_doctor_id
left join public.doctors td on td.id = p.treating_doctor_id
left join public.v_patient_account_summary acc on acc.patient_id = p.id;

-- ---------------------------------------------------------------------------------
--  9.10  PROFITABILITY
--        revenue - attendant cost - directly attributed costs = gross contribution
-- ---------------------------------------------------------------------------------
create view public.v_patient_profitability_monthly with (security_invoker = on) as
with duty as (
  select
    a.patient_id,
    public.month_of(a.duty_date)                          as period_month,
    coalesce(sum(a.patient_units * a.patient_rate_applied), 0)      as revenue,
    coalesce(sum(a.staff_units   * a.staff_wage_applied), 0)        as wage_cost,
    coalesce(sum(a.overtime_hours * a.ot_hourly_rate_applied), 0)   as overtime_cost,
    coalesce(sum(a.patient_units), 0)                               as billable_units
  from public.attendance a
  group by 1, 2
),
exp as (
  select
    patient_id,
    public.month_of(expense_date) as period_month,
    coalesce(sum(amount), 0)                as direct_expenses
  from public.operating_expenses
  where patient_id is not null
  group by 1, 2
),
periods as (
  select patient_id, period_month from duty
  union
  select patient_id, period_month from exp
)
select
  pr.patient_id,
  pt.patient_code,
  pt.full_name                          as patient_name,
  pt.service_type,
  pr.period_month,
  to_char(pr.period_month, 'Mon YYYY')  as period_label,
  coalesce(d.billable_units, 0)         as billable_units,
  round(coalesce(d.revenue, 0), 2)      as revenue,
  round(coalesce(d.wage_cost, 0), 2)    as attendant_wage_cost,
  round(coalesce(d.overtime_cost, 0), 2) as overtime_cost,
  round(coalesce(e.direct_expenses, 0), 2) as other_direct_costs,
  round(coalesce(d.revenue, 0)
      - coalesce(d.wage_cost, 0)
      - coalesce(d.overtime_cost, 0)
      - coalesce(e.direct_expenses, 0), 2) as gross_contribution,
  case when coalesce(d.revenue, 0) > 0 then
    round((coalesce(d.revenue, 0) - coalesce(d.wage_cost, 0)
         - coalesce(d.overtime_cost, 0) - coalesce(e.direct_expenses, 0))
         * 100.0 / d.revenue, 2)
  end                                    as margin_pct
from periods pr
join public.patients pt on pt.id = pr.patient_id
left join duty d on d.patient_id = pr.patient_id and d.period_month = pr.period_month
left join exp  e on e.patient_id = pr.patient_id and e.period_month = pr.period_month;

comment on view public.v_patient_profitability_monthly is
  'Gross contribution per patient per month = revenue - attendant wages - overtime - directly attributed costs.';

create view public.v_agency_monthly_pnl with (security_invoker = on) as
with pat as (
  select period_month,
         count(*)                    as active_patients,
         sum(revenue)                as revenue,
         sum(attendant_wage_cost)    as attendant_wage_cost,
         sum(overtime_cost)          as overtime_cost,
         sum(other_direct_costs)     as direct_costs,
         sum(gross_contribution)     as gross_contribution
  from public.v_patient_profitability_monthly
  group by 1
),
ovh as (
  select public.month_of(expense_date) as period_month,
         sum(amount)                             as overhead_costs
  from public.operating_expenses
  where patient_id is null
  group by 1
),
periods as (
  select period_month from pat
  union
  select period_month from ovh
)
select
  pr.period_month,
  to_char(pr.period_month, 'Mon YYYY')            as period_label,
  coalesce(p.active_patients, 0)                  as active_patients,
  round(coalesce(p.revenue, 0), 2)                as revenue,
  round(coalesce(p.attendant_wage_cost, 0), 2)    as attendant_wage_cost,
  round(coalesce(p.overtime_cost, 0), 2)          as overtime_cost,
  round(coalesce(p.direct_costs, 0), 2)           as direct_costs,
  round(coalesce(p.gross_contribution, 0), 2)     as gross_contribution,
  round(coalesce(o.overhead_costs, 0), 2)         as overhead_costs,
  round(coalesce(p.gross_contribution, 0) - coalesce(o.overhead_costs, 0), 2) as net_contribution,
  case when coalesce(p.revenue, 0) > 0
       then round((coalesce(p.gross_contribution, 0) - coalesce(o.overhead_costs, 0))
                  * 100.0 / p.revenue, 2)
  end                                             as net_margin_pct
from periods pr
left join pat p on p.period_month = pr.period_month
left join ovh o on o.period_month = pr.period_month;

-- =====================================================================================
--  SECTION 10 — SETTLEMENT FUNCTIONS
--  These turn the live views into locked, auditable documents.
--  All are SECURITY DEFINER and guard on role, so they can be exposed straight to the
--  Next.js client through supabase.rpc(). They pass when there is no JWT, which is how
--  the SQL Editor, the service_role key and pg_cron run.
-- =====================================================================================

-- ---------------------------------------------------------------------------------
--  10.1  Build (or rebuild) a month's payroll, recovering advances instalment by
--        instalment, oldest advance first, never more than the payslip can bear.
-- ---------------------------------------------------------------------------------
create or replace function public.fn_create_payroll_run(
  p_period date,
  p_notes  text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_month     date := public.month_of(p_period);
  v_month_end date := (public.month_of(p_period) + interval '1 month - 1 day')::date;
  v_run_id    uuid;
  v_status    public.payroll_status;
  v_item      record;
  v_adv       record;
  v_take      numeric(12,2);
  v_remaining numeric(12,2);
  v_recovered numeric(12,2);
begin
  if not (public.is_finance() or public.is_service_context()) then
    raise exception 'Only an admin or accountant may run payroll' using errcode = '42501';
  end if;

  select id, status into v_run_id, v_status
  from public.payroll_runs where period_month = v_month;

  if v_run_id is null then
    insert into public.payroll_runs (period_month, status, notes, created_by)
    values (v_month, 'draft', p_notes, auth.uid())
    returning id into v_run_id;
  elsif v_status <> 'draft' then
    raise exception 'Payroll for % is already %. Call fn_reopen_payroll_run() first.',
      to_char(v_month, 'Mon YYYY'), v_status using errcode = '23514';
  else
    -- Rebuild: drop the instalments this run created, keep manual recoveries.
    delete from public.advance_recoveries
     where payroll_item_id in (select id from public.payroll_items where payroll_run_id = v_run_id);
    delete from public.payroll_items where payroll_run_id = v_run_id;
  end if;

  -- Step 1: attendance and adjustments straight off the live view.
  -- advance_recovery starts at whatever was already recovered by hand this month.
  insert into public.payroll_items (
    payroll_run_id, staff_id, period_month,
    days_present, half_days, days_absent, paid_leave_days, replacement_duties,
    payable_units, overtime_hours,
    gross_wage, overtime_amount, additions, other_deductions, advance_recovery)
  select
    v_run_id, v.staff_id, v_month,
    v.days_present, v.half_days, v.days_absent, v.paid_leave_days, v.replacement_duties,
    v.payable_units, v.overtime_hours,
    v.gross_wage, v.overtime_amount, v.additions, v.other_deductions, v.advance_recovered
  from public.v_staff_monthly_salary v
  where v.period_month = v_month;

  -- Step 2: recover open advances, oldest first, capped by what the payslip can bear.
  for v_item in
    select pi.id, pi.staff_id,
           (pi.gross_wage + pi.overtime_amount + pi.additions
            - pi.other_deductions - pi.advance_recovery) as available
    from public.payroll_items pi
    where pi.payroll_run_id = v_run_id
  loop
    v_remaining := greatest(v_item.available, 0);
    v_recovered := 0;

    for v_adv in
      select a.id, a.balance_amount, a.recovery_per_cycle
      from public.staff_advances a
      where a.staff_id = v_item.staff_id
        and a.status = 'open'
        and a.balance_amount > 0
        and a.issued_on <= v_month_end
      order by a.issued_on, a.created_at
    loop
      exit when v_remaining <= 0;

      v_take := least(
        case when v_adv.recovery_per_cycle = 0
             then v_adv.balance_amount
             else v_adv.recovery_per_cycle end,
        v_adv.balance_amount,
        v_remaining);

      if v_take > 0 then
        insert into public.advance_recoveries
          (advance_id, payroll_item_id, recovery_date, amount, notes, created_by)
        values (v_adv.id, v_item.id, v_month_end, v_take,
                'Auto-recovered by payroll ' || to_char(v_month, 'Mon YYYY'), auth.uid());
        v_remaining := v_remaining - v_take;
        v_recovered := v_recovered + v_take;
      end if;
    end loop;

    if v_recovered > 0 then
      update public.payroll_items
         set advance_recovery = advance_recovery + v_recovered
       where id = v_item.id;
    end if;
  end loop;

  -- Step 3: roll up the run header.
  update public.payroll_runs r
     set total_gross      = t.gross,
         total_deductions = t.deductions,
         total_net        = t.net,
         staff_count      = t.cnt,
         generated_at     = now()
  from (
    select coalesce(sum(gross_wage + overtime_amount + additions), 0) as gross,
           coalesce(sum(other_deductions + advance_recovery), 0)      as deductions,
           coalesce(sum(net_payable), 0)                              as net,
           count(*)                                                   as cnt
    from public.payroll_items where payroll_run_id = v_run_id
  ) t
  where r.id = v_run_id;

  return v_run_id;
end $$;

comment on function public.fn_create_payroll_run(date, text) is
  'Freeze a month of payroll. Idempotent while the run is still draft: re-running rebuilds it.';

create or replace function public.fn_approve_payroll_run(p_run_id uuid)
returns public.payroll_runs
language plpgsql security definer set search_path = public as $$
declare v_row public.payroll_runs;
begin
  if not (public.is_finance() or public.is_service_context()) then
    raise exception 'Only an admin or accountant may approve payroll' using errcode = '42501';
  end if;

  update public.payroll_runs
     set status = 'approved', approved_by = auth.uid(), approved_at = now()
   where id = p_run_id and status = 'draft'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Payroll run % not found or not in draft', p_run_id;
  end if;
  return v_row;
end $$;

-- Approving locks the month's attendance (Section 07). This is the escape hatch.
create or replace function public.fn_reopen_payroll_run(p_run_id uuid)
returns public.payroll_runs
language plpgsql security definer set search_path = public as $$
declare v_row public.payroll_runs;
begin
  if not (public.is_admin() or public.is_service_context()) then
    raise exception 'Only an admin may reopen an approved payroll run' using errcode = '42501';
  end if;

  update public.payroll_runs
     set status = 'draft', approved_by = null, approved_at = null, paid_at = null
   where id = p_run_id and status in ('approved','cancelled')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Payroll run % not found, or it has already been paid', p_run_id;
  end if;
  return v_row;
end $$;

create or replace function public.fn_mark_payslip_paid(
  p_item_id   uuid,
  p_amount    numeric default null,
  p_mode      public.payment_mode default 'bank_transfer',
  p_reference text default null
) returns public.payroll_items
language plpgsql security definer set search_path = public as $$
declare v_row public.payroll_items;
begin
  if not (public.is_finance() or public.is_service_context()) then
    raise exception 'Only an admin or accountant may disburse salary' using errcode = '42501';
  end if;

  update public.payroll_items pi
     set paid_amount       = coalesce(p_amount, pi.net_payable),
         payment_status    = (case when coalesce(p_amount, pi.net_payable) >= pi.net_payable
                                   then 'paid' else 'partially_paid' end)::public.payslip_payment_status,
         paid_at           = now(),
         payment_mode      = p_mode,
         payment_reference = p_reference
   where pi.id = p_item_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Payslip % not found', p_item_id;
  end if;
  return v_row;
end $$;

-- ---------------------------------------------------------------------------------
--  10.2  Generate a patient's monthly invoice from fulfilled duties.
--        One line per posting per rate, so a mid-month rate change bills correctly.
-- ---------------------------------------------------------------------------------
create or replace function public.fn_generate_patient_invoice(
  p_patient_id uuid,
  p_period     date,
  p_issue      boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_month     date := public.month_of(p_period);
  v_month_end date := (public.month_of(p_period) + interval '1 month - 1 day')::date;
  v_inv       uuid;
  v_status    public.invoice_status;
  v_patient   public.patients;
  v_credit    numeric(12,2);
  v_taxable   numeric(12,2);
begin
  if not (public.is_finance() or public.is_service_context()) then
    raise exception 'Only an admin or accountant may raise an invoice' using errcode = '42501';
  end if;

  select * into v_patient from public.patients where id = p_patient_id;
  if not found then
    raise exception 'Patient % not found', p_patient_id;
  end if;

  select id, status into v_inv, v_status
  from public.patient_invoices
  where patient_id = p_patient_id and period_month = v_month;

  if v_inv is null then
    insert into public.patient_invoices (
      patient_id, period_month, period_start, period_end, invoice_date,
      customer_gstin, is_gst_exempt, created_by)
    values (
      p_patient_id, v_month, v_month, v_month_end, least(v_month_end, current_date),
      v_patient.customer_gstin, not v_patient.gst_applicable, auth.uid())
    returning id into v_inv;
  elsif v_status <> 'draft' then
    raise exception 'Invoice for % % is already %. Cancel it before regenerating.',
      v_patient.full_name, to_char(v_month, 'Mon YYYY'), v_status using errcode = '23514';
  else
    delete from public.patient_invoice_lines where invoice_id = v_inv;
  end if;

  insert into public.patient_invoice_lines
    (invoice_id, duty_allocation_id, description, hsn_sac, quantity, uom, rate, sort_order)
  select
    v_inv,
    x.duty_allocation_id,
    format('%s - %s (%s to %s)',
           case x.duty_type
             when 'shift_24h' then '24-hour attendant duty'
             when 'shift_12h' then '12-hour attendant duty (' || x.shift_slot || ')'
             else 'Nurse visit' end,
           x.staff_name,
           to_char(x.first_date, 'DD Mon'), to_char(x.last_date, 'DD Mon YYYY')),
    '999319',
    x.units,
    case when x.duty_type = 'visit' then 'VISIT' else 'DAY' end,
    x.rate,
    (row_number() over (order by x.first_date))::smallint
  from (
    select
      a.duty_allocation_id,
      al.duty_type,
      al.shift_slot::text          as shift_slot,
      s.full_name                  as staff_name,
      a.patient_rate_applied       as rate,
      sum(a.patient_units)         as units,
      min(a.duty_date)             as first_date,
      max(a.duty_date)             as last_date
    from public.attendance a
    join public.duty_allocations al on al.id = a.duty_allocation_id
    join public.staff s             on s.id  = al.staff_id
    where a.patient_id = p_patient_id
      and a.duty_date between v_month and v_month_end
      and a.patient_units > 0
    group by a.duty_allocation_id, al.duty_type, al.shift_slot, s.full_name, a.patient_rate_applied
  ) x;

  -- Apply any unadjusted advance sitting on the patient's account.
  select coalesce((select sum(amount) from public.patient_payments
                    where patient_id = p_patient_id and direction = 'advance'), 0)
       - coalesce((select sum(advance_adjusted) from public.patient_invoices
                    where patient_id = p_patient_id and id <> v_inv
                      and status <> 'cancelled'), 0)
    into v_credit;

  select taxable_value into v_taxable from public.patient_invoices where id = v_inv;

  update public.patient_invoices
     set advance_adjusted = greatest(least(coalesce(v_credit, 0), coalesce(v_taxable, 0)), 0),
         status = (case when p_issue then 'issued'::public.invoice_status else status end)
   where id = v_inv;

  return v_inv;
end $$;

comment on function public.fn_generate_patient_invoice(uuid, date, boolean) is
  'Build a patient monthly invoice from attendance. Idempotent while draft; refuses once issued.';

-- =====================================================================================
--  SECTION 11 — ROW LEVEL SECURITY
--
--  Four roles, held on public.profiles:
--    admin       everything, including KYC, bank details and reopening locked payroll
--    coordinator operations: patients, staff, postings, attendance. No money.
--    accountant  money: advances, invoices, receipts, payroll, expenses. Read-only ops.
--    attendant   their own record, their own duties, their own attendance and payslips
--
--  With these policies the anon/authenticated key is safe to use from the browser.
--  The service_role key bypasses RLS entirely — keep it server-side only.
-- =====================================================================================

-- A user may edit their own name and phone, but not promote themselves.
create or replace function public.fn_profiles_guard()
returns trigger language plpgsql as $$
begin
  if public.is_admin() or public.is_service_context() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.staff_id is distinct from old.staff_id
     or new.is_active is distinct from old.is_active then
    raise exception 'Only an admin may change a role, staff link or active flag'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.fn_profiles_guard();

-- Enable RLS everywhere -------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','doctors','patients','staff','staff_kyc','staff_documents',
    'staff_bank_accounts','duty_allocations','leave_requests','attendance',
    'payroll_runs','payroll_items','staff_advances','advance_recoveries',
    'payroll_adjustments','patient_invoices','patient_invoice_lines',
    'patient_payments','operating_expenses','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- start from a clean slate so this script stays re-runnable
    execute (
      select coalesce(string_agg(format('drop policy if exists %I on public.%I;', policyname, t), ' '), '')
      from pg_policies where schemaname = 'public' and tablename = t
    );
  end loop;
end $$;

-- 11.1  profiles ---------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_back_office());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.is_admin());

-- 11.2  doctors ----------------------------------------------------------------------
create policy doctors_select on public.doctors for select to authenticated using (true);
create policy doctors_write  on public.doctors for all to authenticated
  using (public.current_app_role() in ('admin','coordinator'))
  with check (public.current_app_role() in ('admin','coordinator'));

-- 11.3  patients ---------------------------------------------------------------------
--  An attendant sees only the patients they are currently posted to — they need the
--  address and the family phone number, and nothing beyond that.
create policy patients_select on public.patients for select to authenticated
  using (
    public.is_back_office()
    or exists (
      select 1 from public.duty_allocations al
      where al.patient_id = patients.id
        and al.staff_id  = public.current_staff_id()
        and al.status in ('ongoing','on_hold')
    )
  );
create policy patients_insert on public.patients for insert to authenticated
  with check (public.current_app_role() in ('admin','coordinator'));
create policy patients_update on public.patients for update to authenticated
  using (public.current_app_role() in ('admin','coordinator'))
  with check (public.current_app_role() in ('admin','coordinator'));
create policy patients_delete on public.patients for delete to authenticated
  using (public.is_admin());

-- 11.4  staff and their sensitive sub-tables ------------------------------------------
create policy staff_select on public.staff for select to authenticated
  using (public.is_back_office() or id = public.current_staff_id());
create policy staff_insert on public.staff for insert to authenticated
  with check (public.current_app_role() in ('admin','coordinator'));
create policy staff_update on public.staff for update to authenticated
  using (public.current_app_role() in ('admin','coordinator'))
  with check (public.current_app_role() in ('admin','coordinator'));
create policy staff_delete on public.staff for delete to authenticated
  using (public.is_admin());

create policy staff_kyc_select on public.staff_kyc for select to authenticated
  using (public.is_admin() or staff_id = public.current_staff_id());
create policy staff_kyc_write on public.staff_kyc for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy staff_docs_select on public.staff_documents for select to authenticated
  using (public.is_back_office() or staff_id = public.current_staff_id());
create policy staff_docs_insert on public.staff_documents for insert to authenticated
  with check (public.is_back_office() or staff_id = public.current_staff_id());
create policy staff_docs_update on public.staff_documents for update to authenticated
  using (public.current_app_role() in ('admin','coordinator'))
  with check (public.current_app_role() in ('admin','coordinator'));
create policy staff_docs_delete on public.staff_documents for delete to authenticated
  using (public.is_admin());

create policy staff_bank_select on public.staff_bank_accounts for select to authenticated
  using (public.is_finance() or staff_id = public.current_staff_id());
create policy staff_bank_write on public.staff_bank_accounts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 11.5  duty allocations ----------------------------------------------------------------
create policy alloc_select on public.duty_allocations for select to authenticated
  using (public.is_back_office() or staff_id = public.current_staff_id());
create policy alloc_write on public.duty_allocations for all to authenticated
  using (public.current_app_role() in ('admin','coordinator'))
  with check (public.current_app_role() in ('admin','coordinator'));

-- 11.6  leave ---------------------------------------------------------------------------
create policy leave_select on public.leave_requests for select to authenticated
  using (public.is_back_office() or staff_id = public.current_staff_id());
create policy leave_insert on public.leave_requests for insert to authenticated
  with check (public.is_back_office() or staff_id = public.current_staff_id());
create policy leave_update on public.leave_requests for update to authenticated
  using (
    public.current_app_role() in ('admin','coordinator')
    or (staff_id = public.current_staff_id() and status = 'pending')
  )
  with check (
    public.current_app_role() in ('admin','coordinator')
    or staff_id = public.current_staff_id()
  );
create policy leave_delete on public.leave_requests for delete to authenticated
  using (public.is_admin());

-- 11.7  attendance -----------------------------------------------------------------------
--  An attendant may punch in and out for their own duty, today or yesterday.
--  trg_attendance_field_guard stops them touching status, rates or overtime.
create policy attendance_select on public.attendance for select to authenticated
  using (public.is_back_office() or staff_id = public.current_staff_id());
create policy attendance_insert on public.attendance for insert to authenticated
  with check (
    public.current_app_role() in ('admin','coordinator')
    or (staff_id = public.current_staff_id()
        and duty_date between current_date - 1 and current_date)
  );
create policy attendance_update on public.attendance for update to authenticated
  using (
    public.current_app_role() in ('admin','coordinator')
    or (staff_id = public.current_staff_id()
        and duty_date between current_date - 1 and current_date)
  )
  with check (
    public.current_app_role() in ('admin','coordinator')
    or staff_id = public.current_staff_id()
  );
create policy attendance_delete on public.attendance for delete to authenticated
  using (public.current_app_role() in ('admin','coordinator'));

-- 11.8  advances, adjustments, payroll ------------------------------------------------------
create policy advances_select on public.staff_advances for select to authenticated
  using (public.is_finance() or staff_id = public.current_staff_id());
create policy advances_write on public.staff_advances for all to authenticated
  using (public.is_finance()) with check (public.is_finance());

create policy adv_rec_select on public.advance_recoveries for select to authenticated
  using (
    public.is_finance()
    or exists (select 1 from public.staff_advances a
               where a.id = advance_recoveries.advance_id
                 and a.staff_id = public.current_staff_id())
  );
create policy adv_rec_write on public.advance_recoveries for all to authenticated
  using (public.is_finance()) with check (public.is_finance());

create policy adjustments_select on public.payroll_adjustments for select to authenticated
  using (public.is_finance() or staff_id = public.current_staff_id());
create policy adjustments_write on public.payroll_adjustments for all to authenticated
  using (public.is_finance()) with check (public.is_finance());

create policy payroll_runs_select on public.payroll_runs for select to authenticated
  using (public.is_back_office());
create policy payroll_runs_write on public.payroll_runs for all to authenticated
  using (public.is_finance()) with check (public.is_finance());

create policy payroll_items_select on public.payroll_items for select to authenticated
  using (public.is_finance() or staff_id = public.current_staff_id());
create policy payroll_items_write on public.payroll_items for all to authenticated
  using (public.is_finance()) with check (public.is_finance());

-- 11.9  patient money ------------------------------------------------------------------------
create policy invoices_select on public.patient_invoices for select to authenticated
  using (public.is_back_office());
create policy invoices_write on public.patient_invoices for all to authenticated
  using (public.is_finance()) with check (public.is_finance());

create policy invoice_lines_select on public.patient_invoice_lines for select to authenticated
  using (public.is_back_office());
create policy invoice_lines_write on public.patient_invoice_lines for all to authenticated
  using (public.is_finance()) with check (public.is_finance());

create policy payments_select on public.patient_payments for select to authenticated
  using (public.is_back_office());
create policy payments_write on public.patient_payments for all to authenticated
  using (public.is_finance()) with check (public.is_finance());

create policy expenses_select on public.operating_expenses for select to authenticated
  using (public.is_back_office());
create policy expenses_write on public.operating_expenses for all to authenticated
  using (public.is_finance()) with check (public.is_finance());

-- 11.10  audit log is read-only, admin-only. Rows arrive via SECURITY DEFINER triggers.
create policy audit_select on public.audit_log for select to authenticated
  using (public.is_admin());

-- =====================================================================================
--  GRANTS
-- =====================================================================================
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema public from anon';
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all functions in schema public from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema public to authenticated';
    execute 'grant select, insert, update, delete on all tables in schema public to authenticated';
    execute 'grant usage, select on all sequences in schema public to authenticated';
    execute 'grant execute on all functions in schema public to authenticated';
    execute 'alter default privileges in schema public
               grant select, insert, update, delete on tables to authenticated';
    execute 'alter default privileges in schema public grant usage, select on sequences to authenticated';
    execute 'alter default privileges in schema public grant execute on functions to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant usage on schema public to service_role';
    execute 'grant all on all tables in schema public to service_role';
    execute 'grant all on all sequences in schema public to service_role';
    execute 'grant all on all functions in schema public to service_role';
  end if;
end $$;

-- The audit trail must not be editable, even by an admin, through the API.
revoke insert, update, delete on public.audit_log from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke insert, update, delete on public.audit_log from authenticated';
  end if;
end $$;

-- =====================================================================================
--  SECTION 12 — SAMPLE DATA
--  Delete this whole section before going live. Fixed UUIDs make it re-runnable.
--  Scenario: August 2026, Mumbai. Two attendant postings and one nurse-visit case.
-- =====================================================================================

do $seed$
begin
  if exists (select 1 from public.patients
             where id = 'a0000000-0000-4000-8000-000000000001') then
    raise notice 'HealthHome24 sample data is already loaded - section 12 skipped.';
    return;
  end if;

  -- 12.1  Doctors ------------------------------------------------------------------------
  insert into public.doctors (id, full_name, qualification, specialization, hospital_name, phone, registration_number)
  values
    ('d0000000-0000-4000-8000-000000000001', 'Dr. Anil Kulkarni',   'MBBS, MD (Medicine)',  'Internal Medicine', 'P. D. Hinduja Hospital, Mahim', '9820011223', 'MMC-2004-51872'),
    ('d0000000-0000-4000-8000-000000000002', 'Dr. Farida Merchant', 'MBBS, MD, DM (Neuro)', 'Neurology',         'Lilavati Hospital, Bandra West', '9821044556', 'MMC-1999-33410')
  on conflict (id) do nothing;

  -- 12.2  Patients ------------------------------------------------------------------------
  insert into public.patients (
    id, full_name, gender, date_of_birth,
    address_line1, address_line2, landmark, area, city, state, pincode, latitude, longitude,
    primary_contact_name, primary_contact_phone, primary_contact_relation,
    family_contact_name, family_contact_phone, family_contact_relation,
    referring_doctor_id, treating_doctor_id, diagnosis, care_requirements, mobility_status,
    service_type, default_daily_rate, billing_cycle, security_deposit,
    start_date, status, referral_source
  ) values
    ('a0000000-0000-4000-8000-000000000001', 'Sunanda Deshmukh', 'female', '1948-03-11',
     'Flat 402, Shanti Sadan', 'Ranade Road, Shivaji Park', 'Opp. Shivaji Park Gymkhana', 'Dadar West', 'Mumbai', 'Maharashtra', '400028',
     19.027000, 72.841000,
     'Milind Deshmukh', '9819234567', 'Son',
     'Vaishali Deshmukh', '9820987654', 'Daughter-in-law',
     'd0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002',
     'CVA (left hemiparesis), hypertension, Type 2 diabetes',
     'Round-the-clock attendant. Bed transfers, sponge bath, diaper change, feeding, BP and sugar log twice daily, passive limb physiotherapy.',
     'Bed-bound, needs two-person transfer',
     'attendant_24h', 1800.00, 'monthly', 10000.00,
     '2026-07-15', 'active', 'Hospital discharge desk - Lilavati'),

    ('a0000000-0000-4000-8000-000000000002', 'Rajesh Iyer', 'male', '1955-09-02',
     'B-1104, Lake Castle', 'Hiranandani Gardens', 'Near Powai Plaza', 'Powai', 'Mumbai', 'Maharashtra', '400076',
     19.119700, 72.905100,
     'Rajesh Iyer', '9930112233', 'Self',
     'Meera Iyer', '9930445566', 'Wife',
     'd0000000-0000-4000-8000-000000000001', null,
     'Post-operative - right total knee replacement (28-Jul-2026)',
     'Day attendant 8am-8pm. Walker-assisted mobilisation, ice therapy, wound observation, escort to physiotherapy.',
     'Walker-assisted, improving',
     'attendant_12h', 1100.00, 'monthly', 5000.00,
     '2026-08-01', 'active', 'Referral - Dr. Anil Kulkarni'),

    ('a0000000-0000-4000-8000-000000000003', 'Zubeida Shaikh', 'female', '1960-12-19',
     '14, Rose Manor', 'Off Hill Road', 'Near St. Peters Church', 'Bandra West', 'Mumbai', 'Maharashtra', '400050',
     19.052800, 72.825900,
     'Imran Shaikh', '9867223344', 'Son',
     null, null, null,
     'd0000000-0000-4000-8000-000000000001', null,
     'Diabetic foot ulcer, grade 2',
     'Alternate-day nurse visit for dressing, blood sugar check and insulin administration.',
     'Ambulant',
     'nurse_visit', 700.00, 'monthly', 0,
     '2026-08-03', 'active', 'Walk-in')
  on conflict (id) do nothing;

  -- 12.3  Attendants and nurses --------------------------------------------------------------
  insert into public.staff (
    id, full_name, category, gender, date_of_birth, phone, alternate_phone,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    address_line1, area, city, pincode, native_address,
    qualification, specialization, experience_years, languages, nursing_council_reg_no,
    joining_date, default_daily_wage, default_ot_hourly_rate, is_active
  ) values
    ('b0000000-0000-4000-8000-000000000001', 'Priya Nair', 'nurse', 'female', '1993-06-14',
     '9769112233', '9769112244',
     'Suresh Nair', '9769445566', 'Husband',
     'Room 6, Ganesh Chawl, Kalina', 'Santacruz East', 'Mumbai', '400098', 'Kollam, Kerala',
     'GNM (General Nursing & Midwifery)', 'Wound care, diabetic management', 7.5,
     array['Malayalam','Hindi','English'], 'MNC-GNM-2016-8841',
     '2024-02-01', 1600.00, 120.00, true),

    ('b0000000-0000-4000-8000-000000000002', 'Ramesh Gupta', 'general_attendant', 'male', '1988-11-05',
     '9892334455', null,
     'Sunita Gupta', '9892556677', 'Wife',
     'Room 12, Sai Krupa Chawl, Kurla West', 'Kurla', 'Mumbai', '400070', 'Gorakhpur, Uttar Pradesh',
     'Certified Home Health Aide (6-month course)', 'Bed-bound and stroke care', 9.0,
     array['Hindi','Marathi'], null,
     '2023-06-12', 1200.00, 80.00, true),

    ('b0000000-0000-4000-8000-000000000003', 'Salma Shaikh', 'general_attendant', 'female', '1991-04-22',
     '9137445566', null,
     'Abdul Shaikh', '9137667788', 'Brother',
     '22, Nehru Nagar, Kurla East', 'Kurla', 'Mumbai', '400024', 'Bhiwandi, Maharashtra',
     'Certified Patient Care Assistant', 'Relief and short-notice cover', 4.0,
     array['Hindi','Marathi','Urdu'], null,
     '2025-01-20', 1150.00, 80.00, true),

    ('b0000000-0000-4000-8000-000000000004', 'Lakshmi Prasad', 'general_attendant', 'female', '1995-08-30',
     '9004778899', null,
     'Ganesh Prasad', '9004990011', 'Father',
     'Hut 45, Jai Bhim Nagar, Powai', 'Powai', 'Mumbai', '400076', 'Vizianagaram, Andhra Pradesh',
     'Basic Attendant Training - HealthHome24 in-house', 'Post-operative mobility support', 2.5,
     array['Telugu','Hindi'], null,
     '2025-11-03', 700.00, 60.00, true)
  on conflict (id) do nothing;

  insert into public.staff_kyc (staff_id, aadhaar_number, pan_number, uan_number, kyc_status, police_verified, police_verified_on, notes)
  values
    ('b0000000-0000-4000-8000-000000000001', 'XXXXXXXX4471', 'AKQPN1234C', '101234567890', 'submitted', true,  '2024-02-20', 'Aadhaar held masked; scan in the private staff-kyc bucket.'),
    ('b0000000-0000-4000-8000-000000000002', 'XXXXXXXX8812', 'BJTPG5678K', null,            'submitted', true,  '2023-07-02', 'Aadhaar held masked.'),
    ('b0000000-0000-4000-8000-000000000003', 'XXXXXXXX2210', null,         null,            'pending',   false, null,         'PAN and police verification pending.'),
    ('b0000000-0000-4000-8000-000000000004', 'XXXXXXXX9903', 'CDXPL9012M', null,            'submitted', true,  '2025-11-10', null)
  on conflict (staff_id) do nothing;

  -- staff_kyc_verified_chk requires a named verifier, so nothing is marked 'verified'
  -- until a real admin login exists. Once you have one, run:
  --   update public.staff_kyc
  --      set kyc_status = 'verified', verified_by = '<admin profile uuid>', verified_at = now()
  --    where staff_id = 'b0000000-0000-4000-8000-000000000001';

  insert into public.staff_bank_accounts (staff_id, account_holder_name, account_number, ifsc_code, bank_name, branch_name, account_type, is_primary, is_verified)
  values
    ('b0000000-0000-4000-8000-000000000001', 'Priya Suresh Nair', '50100234567890', 'HDFC0000521', 'HDFC Bank',      'Santacruz East', 'savings', true, true),
    ('b0000000-0000-4000-8000-000000000002', 'Ramesh Kumar Gupta','20345678901234', 'SBIN0011456', 'State Bank of India', 'Kurla West', 'savings', true, true),
    ('b0000000-0000-4000-8000-000000000003', 'Salma Abdul Shaikh','919010023456789','UTIB0000234', 'Axis Bank',      'Kurla East',    'savings', true, false),
    ('b0000000-0000-4000-8000-000000000004', 'Lakshmi Prasad',    '38001122334455',  'ICIC0000123', 'ICICI Bank',     'Powai',         'savings', true, true)
  on conflict (staff_id, account_number, ifsc_code) do nothing;

  -- 12.4  Duty allocations ---------------------------------------------------------------------
  insert into public.duty_allocations (
    id, patient_id, staff_id, duty_type, shift_slot, start_date, end_date,
    patient_daily_rate, staff_daily_wage, ot_hourly_rate, status, notes
  ) values
    ('c0000000-0000-4000-8000-000000000001',
     'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
     'shift_24h', 'full_day', '2026-07-15', null,
     1800.00, 1200.00, 80.00, 'ongoing', '24-hour live-in cover. Family provides meals.'),

    ('c0000000-0000-4000-8000-000000000002',
     'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000004',
     'shift_12h', 'day', '2026-08-01', null,
     1100.00, 700.00, 60.00, 'ongoing', 'Day shift 08:00-20:00. Sunday week-off.'),

    ('c0000000-0000-4000-8000-000000000003',
     'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001',
     'visit', 'visit', '2026-08-03', null,
     700.00, 450.00, 0, 'ongoing', 'Alternate-day dressing. Mon & Thu.')
  on conflict (id) do nothing;

  -- 12.5  August 2026 attendance ------------------------------------------------------------------
  --  Ramesh on the 24-hour posting: present all month except one half day,
  --  one day replaced by Salma, and one unauthorised absence.
  insert into public.attendance (
    duty_allocation_id, staff_id, duty_date, status,
    check_in_at, check_out_at, check_in_lat, check_in_lng, check_out_lat, check_out_lng,
    overtime_hours, replacement_staff_id, notes)
  select
    'c0000000-0000-4000-8000-000000000001'::uuid,
    'b0000000-0000-4000-8000-000000000002'::uuid,
    d::date,
    (case d::date
       when date '2026-08-10' then 'half_day'
       when date '2026-08-17' then 'replaced'
       when date '2026-08-24' then 'absent'
       else 'present' end)::public.attendance_status,
    case when d::date = date '2026-08-24' then null
         else ((d::date + time '08:00') at time zone 'Asia/Kolkata') end,
    case when d::date in (date '2026-08-24') then null
         when d::date = date '2026-08-10' then ((d::date + time '20:00') at time zone 'Asia/Kolkata')
         else ((d::date + 1 + time '08:00') at time zone 'Asia/Kolkata') end,
    -- 08-Aug check-in was punched ~5 km away: v_attendance_detail flags it off-site.
    case when d::date = date '2026-08-24' then null
         when d::date = date '2026-08-08' then 19.076000
         else round((19.027000 + (random() - 0.5) * 0.0009)::numeric, 6) end,
    case when d::date = date '2026-08-24' then null
         when d::date = date '2026-08-08' then 72.877700
         else round((72.841000 + (random() - 0.5) * 0.0009)::numeric, 6) end,
    case when d::date = date '2026-08-24' then null
         else round((19.027000 + (random() - 0.5) * 0.0009)::numeric, 6) end,
    case when d::date = date '2026-08-24' then null
         else round((72.841000 + (random() - 0.5) * 0.0009)::numeric, 6) end,
    case when d::date = date '2026-08-05' then 2.0 else 0 end,
    case when d::date = date '2026-08-17'
         then 'b0000000-0000-4000-8000-000000000003'::uuid end,
    case d::date
      when date '2026-08-10' then 'Left at 8pm, family attendant took over for the night.'
      when date '2026-08-17' then 'Village emergency. Salma Shaikh covered.'
      when date '2026-08-24' then 'No intimation. Coordinator informed the family.'
      when date '2026-08-08' then 'Check-in punched off-site - flagged for review.'
      when date '2026-08-05' then 'Two extra hours: escorted patient to hospital review.'
      else null end
  from generate_series(date '2026-08-01', date '2026-08-31', interval '1 day') d
  on conflict do nothing;

  -- Salma's relief duty: paid to Salma, not re-billed to the patient.
  insert into public.attendance (
    duty_allocation_id, staff_id, duty_date, status, is_replacement,
    check_in_at, check_out_at, check_in_lat, check_in_lng, check_out_lat, check_out_lng, notes)
  values (
    'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003',
    '2026-08-17', 'present', true,
    (timestamp '2026-08-17 08:00' at time zone 'Asia/Kolkata'), (timestamp '2026-08-18 08:00' at time zone 'Asia/Kolkata'),
    19.027100, 72.840900, 19.026900, 72.841200,
    'Relief cover for Ramesh Gupta.')
  on conflict do nothing;

  --  Lakshmi on the 12-hour day shift: Sunday is a week-off, one sick half-day.
  insert into public.attendance (
    duty_allocation_id, staff_id, duty_date, status,
    check_in_at, check_out_at, check_in_lat, check_in_lng, check_out_lat, check_out_lng,
    overtime_hours, notes)
  select
    'c0000000-0000-4000-8000-000000000002'::uuid,
    'b0000000-0000-4000-8000-000000000004'::uuid,
    d::date,
    (case
       when extract(dow from d) = 0            then 'week_off'
       when d::date = date '2026-08-19'        then 'half_day'
       else 'present' end)::public.attendance_status,
    case when extract(dow from d) = 0 then null
         else ((d::date + time '08:00') at time zone 'Asia/Kolkata') end,
    case when extract(dow from d) = 0 then null
         when d::date = date '2026-08-19' then ((d::date + time '14:00') at time zone 'Asia/Kolkata')
         else ((d::date + time '20:00') at time zone 'Asia/Kolkata') end,
    case when extract(dow from d) = 0 then null else round((19.119700 + (random()-0.5)*0.0009)::numeric, 6) end,
    case when extract(dow from d) = 0 then null else round((72.905100 + (random()-0.5)*0.0009)::numeric, 6) end,
    case when extract(dow from d) = 0 then null else round((19.119700 + (random()-0.5)*0.0009)::numeric, 6) end,
    case when extract(dow from d) = 0 then null else round((72.905100 + (random()-0.5)*0.0009)::numeric, 6) end,
    case when d::date = date '2026-08-21' then 3.0 else 0 end,
    case when d::date = date '2026-08-19' then 'Left at 2pm - fever.'
         when d::date = date '2026-08-21' then 'Stayed till 11pm, family stuck in traffic.'
         else null end
  from generate_series(date '2026-08-01', date '2026-08-31', interval '1 day') d
  on conflict do nothing;

  --  Priya's nurse visits: Mondays and Thursdays.
  insert into public.attendance (
    duty_allocation_id, staff_id, duty_date, status,
    check_in_at, check_out_at, check_in_lat, check_in_lng, check_out_lat, check_out_lng, notes)
  select
    'c0000000-0000-4000-8000-000000000003'::uuid,
    'b0000000-0000-4000-8000-000000000001'::uuid,
    d::date, 'present'::public.attendance_status,
    ((d::date + time '11:00') at time zone 'Asia/Kolkata'),
    ((d::date + time '12:00') at time zone 'Asia/Kolkata'),
    round((19.052800 + (random()-0.5)*0.0009)::numeric, 6),
    round((72.825900 + (random()-0.5)*0.0009)::numeric, 6),
    round((19.052800 + (random()-0.5)*0.0009)::numeric, 6),
    round((72.825900 + (random()-0.5)*0.0009)::numeric, 6),
    'Dressing changed, RBS logged, insulin administered.'
  from generate_series(date '2026-08-03', date '2026-08-31', interval '1 day') d
  where extract(dow from d) in (1, 4)
  on conflict do nothing;

  -- 12.6  Advances and loans ------------------------------------------------------------------------
  insert into public.staff_advances (id, staff_id, advance_type, issued_on, amount, reason, recovery_per_cycle, payment_mode, payment_reference, notes)
  values
    ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'advance', '2026-07-20',
     10000.00, 'Family medical emergency in Gorakhpur', 2500.00, 'cash', 'CASHVCH/2026/0117',
     'Recover over four monthly payrolls.'),
    ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000004', 'loan', '2026-08-05',
     5000.00, 'Two-wheeler down payment', 1000.00, 'upi', 'UPI/428811223344', null)
  on conflict (id) do nothing;

  -- 12.7  Payroll adjustments ------------------------------------------------------------------------
  insert into public.payroll_adjustments (staff_id, period_month, kind, category, amount, notes)
  values
    ('b0000000-0000-4000-8000-000000000002', '2026-08-01', 'deduction', 'uniform',        300.00, 'Two sets of scrubs issued.'),
    ('b0000000-0000-4000-8000-000000000001', '2026-08-01', 'addition',  'travel_allowance', 1200.00, 'Auto fare for 9 visits.')
  on conflict do nothing;

  -- 12.8  Patient receipts ----------------------------------------------------------------------------
  insert into public.patient_payments (patient_id, direction, received_on, amount, payment_mode, reference, notes)
  values
    ('a0000000-0000-4000-8000-000000000001', 'security_deposit', '2026-07-15', 10000.00, 'bank_transfer', 'NEFT/HDFC/770231', 'Refundable deposit'),
    ('a0000000-0000-4000-8000-000000000001', 'advance',          '2026-08-02', 30000.00, 'bank_transfer', 'NEFT/HDFC/781902', 'Advance towards August duties'),
    ('a0000000-0000-4000-8000-000000000002', 'security_deposit', '2026-08-01',  5000.00, 'upi',           'UPI/551220099',    'Refundable deposit'),
    ('a0000000-0000-4000-8000-000000000002', 'advance',          '2026-08-03', 15000.00, 'upi',           'UPI/551338877',    'Advance towards August duties'),
    ('a0000000-0000-4000-8000-000000000003', 'advance',          '2026-08-04',  3000.00, 'cash',          'RCPT-CASH-0091',   null)
  on conflict do nothing;

  -- 12.9  Operating expenses --------------------------------------------------------------------------
  insert into public.operating_expenses (expense_date, category, description, amount, patient_id, payment_mode)
  values
    ('2026-08-06', 'consumables', 'Adult diapers, bed protectors, sanitiser', 2400.00, 'a0000000-0000-4000-8000-000000000001', 'cash'),
    ('2026-08-12', 'ppe',         'Gloves and dressing kits for wound care',   900.00, 'a0000000-0000-4000-8000-000000000003', 'upi'),
    ('2026-08-17', 'replacement_cost', 'Emergency relief travel reimbursement', 350.00, 'a0000000-0000-4000-8000-000000000001', 'cash'),
    ('2026-08-01', 'office_rent', 'Dadar back-office rent - August',         35000.00, null, 'bank_transfer'),
    ('2026-08-28', 'marketing',   'Hospital discharge-desk tie-up pamphlets',  4500.00, null, 'upi')
  on conflict do nothing;

  -- 12.10  Settle August 2026 -------------------------------------------------------------------------
  --  Payroll first (it locks attendance), then one invoice per patient.
  perform public.fn_create_payroll_run(date '2026-08-01', 'August 2026 monthly payroll');

  perform public.fn_generate_patient_invoice(p.id, date '2026-08-01', true)
  from public.patients p
  where p.id in (
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000003');

  perform public.fn_approve_payroll_run(id) from public.payroll_runs where period_month = date '2026-08-01';

    raise notice 'HealthHome24 sample data loaded: 3 patients, 4 staff, August 2026 settled.';
end $seed$;

-- =====================================================================================
--  SECTION 13 — VERIFICATION
--  Run these after the seed to confirm the arithmetic. Safe to keep: they only read.
-- =====================================================================================

-- 13.1  Attendant monthly salary for August 2026
--       (present duties x daily wage) + OT + additions - deductions - advance recovery
select staff_name, category, days_present, half_days, days_absent, payable_units,
       overtime_hours, gross_wage, overtime_amount, additions, other_deductions,
       advance_recovered, net_payable
from public.v_staff_monthly_salary
where period_month = date '2026-08-01'
order by net_payable desc;

-- 13.2  Patient monthly bill for August 2026
select patient_name, service_type, duties_billed, billable_units, billed_amount,
       advances_received, payments_received, opening_balance, closing_balance
from public.v_patient_monthly_billing
where period_month = date '2026-08-01'
order by billed_amount desc;

-- 13.3  Profitability per patient
select patient_name, revenue, attendant_wage_cost, overtime_cost, other_direct_costs,
       gross_contribution, margin_pct
from public.v_patient_profitability_monthly
where period_month = date '2026-08-01'
order by gross_contribution desc;

-- 13.4  Agency P&L
select * from public.v_agency_monthly_pnl where period_month = date '2026-08-01';

-- 13.5  Advances outstanding
select staff_name, advance_type, amount, recovered_amount, balance_amount,
       recovery_per_cycle, next_cycle_recovery, status
from public.v_staff_advance_balances
order by balance_amount desc;

-- 13.6  Frozen payslips vs. the live view (these must agree)
select p.staff_name, p.net_payable as payslip_net, v.net_payable as live_net,
       p.net_payable - v.net_payable as variance
from public.v_staff_payslips p
join public.v_staff_monthly_salary v
  on v.staff_id = p.staff_id and v.period_month = p.period_month
where p.period_month = date '2026-08-01';

-- 13.7  Invoices raised
select i.invoice_number, pt.full_name as patient, i.period_month, i.subtotal,
       i.taxable_value, i.total_amount, i.advance_adjusted, i.amount_paid,
       i.balance_due, i.status
from public.patient_invoices i
join public.patients pt on pt.id = i.patient_id
order by i.invoice_number;

-- 13.8  GPS exceptions: duties where the check-in was outside the patient's geo-fence
select duty_date, staff_name, patient_name, check_in_distance_m, check_in_on_site
from public.v_attendance_detail
where check_in_on_site is false
order by duty_date;

-- 13.9  Duty-level margin, most recent first
select duty_date, patient_name, staff_name, status, billed_amount, total_staff_cost, day_contribution
from public.v_attendance_detail
where period_month = date '2026-08-01'
order by duty_date desc, patient_name
limit 15;

-- =====================================================================================
--  SECTION 14 — APPENDIX: HOW THE NEXT.JS APP TALKS TO THIS SCHEMA
--  Reference only; nothing below executes.
-- =====================================================================================
--
--  READ FROM VIEWS, WRITE TO TABLES.
--    Patient list / detail    ->  from('v_patient_master')
--    Today's duty board       ->  from('v_daily_roster').eq('duty_date', today)
--    Payroll screen           ->  from('v_staff_monthly_salary').eq('period_month','2026-08-01')
--    Patient statement        ->  from('v_patient_monthly_billing')
--    Margin dashboard         ->  from('v_patient_profitability_monthly') / from('v_agency_monthly_pnl')
--    Attendant mobile home    ->  from('duty_allocations').eq('status','ongoing')   (RLS filters to their own)
--
--  MOBILE CHECK-IN (runs under the attendant's own JWT; RLS and the field guard
--  keep them honest — they can set the timestamp and the coordinates, nothing else):
--
--    await supabase.from('attendance').insert({
--      duty_allocation_id: allocationId,
--      duty_date: todayISO,                       // must be today or yesterday
--      check_in_at: new Date().toISOString(),
--      check_in_lat: coords.latitude,
--      check_in_lng: coords.longitude,
--      check_in_accuracy_m: coords.accuracy,
--    })
--    // staff_id, patient_id, shift_slot and all three rates are filled server-side.
--
--  MONTH-END, from a server action or route handler:
--
--    const { data: runId } = await supabase.rpc('fn_create_payroll_run',
--                                               { p_period: '2026-08-01' })
--    // review the draft in the UI, then:
--    await supabase.rpc('fn_approve_payroll_run', { p_run_id: runId })
--    await supabase.rpc('fn_generate_patient_invoice',
--                       { p_patient_id: id, p_period: '2026-08-01', p_issue: true })
--
--  Approving a run and issuing an invoice both lock that month's attendance.
--  fn_reopen_payroll_run() (admin only) is the way back; cancel the invoice to
--  unlock the patient side.
--
--  THINGS TO WIRE UP OUTSIDE THE DATABASE
--    1. Storage: create PRIVATE buckets `staff-kyc` and `staff-photos`. Only paths
--       go in staff_documents / staff_kyc; serve them with signed URLs.
--    2. Aadhaar: keep storing the masked form. The domain accepts 12 digits, but
--       UIDAI rules make full storage by a private agency a liability, not a feature.
--    3. Timezone: everything is timestamptz. Format in Asia/Kolkata on the client;
--       duty_date is a plain date and is already the local calendar day.
--    4. Backups: Supabase PITR, plus a monthly export of payroll_items and
--       patient_invoices. Those two tables are your statutory record.
--    5. Money: never read a rupee amount into a JS float for anything but display.
--       Every amount here is numeric(12,2).
--    6. First admin: sign the user up, then
--          update public.profiles set role='admin' where id='<their uuid>';
--       run once from the SQL Editor, which bypasses RLS.
