-- Run FIRST. Tables, constraints, indexes.
create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  student_id text unique,
  role text not null default 'scholar' check (role in ('scholar','staff')),
  created_at timestamptz not null default now()
);

create table scholarship_programs (
  id serial primary key,
  name text not null unique,
  max_gwa numeric(3,2) not null check (max_gwa between 1 and 5),
  min_units int not null check (min_units >= 0),
  max_failed int not null check (max_failed >= 0),
  max_incomplete int not null check (max_incomplete >= 0),
  max_dropped int not null check (max_dropped >= 0),
  deadline timestamptz not null,
  created_at timestamptz not null default now()
);

create table scholar_assignments (
  id serial primary key,
  scholar_id uuid not null unique references profiles(id) on delete cascade,
  program_id int not null references scholarship_programs(id),
  created_at timestamptz not null default now()
);

create table semester_submissions (
  id uuid primary key default gen_random_uuid(),
  scholar_id uuid not null references profiles(id),
  program_id int not null references scholarship_programs(id),
  academic_year text not null check (academic_year ~ '^\d{4}-\d{4}$'),
  semester text not null check (semester in ('1','2','Summer')),
  gwa numeric(3,2) not null check (gwa between 1.00 and 5.00),
  enrolled_units int not null check (enrolled_units >= 0),
  failed_count int not null check (failed_count >= 0),
  incomplete_count int not null check (incomplete_count >= 0),
  dropped_count int not null check (dropped_count >= 0),
  evidence_reference text not null check (length(trim(evidence_reference)) > 0),
  submitted_at timestamptz not null default now(),
  verification_status text not null default 'Pending verification'
    check (verification_status in ('Pending verification','Verified','Returned')),
  verification_reason text,
  compliance_status text not null default 'Not evaluated'
    check (compliance_status in ('Not evaluated','Compliant','With Deficiency')),
  deficiency_reasons jsonb,
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scholar_id, academic_year, semester)
);
create index on semester_submissions (scholar_id);
create index on semester_submissions (program_id);

create table renewal_decisions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references semester_submissions(id),
  decision text not null check (decision in ('Approved','Held')),
  decision_notes text not null check (length(trim(decision_notes)) > 0),
  decided_by uuid not null references profiles(id),
  decided_at timestamptz not null default now()
);
create index on renewal_decisions (submission_id);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  submission_id uuid references semester_submissions(id),
  action text not null,
  details text,
  created_at timestamptz not null default now()
);
create index on audit_logs (submission_id);

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
