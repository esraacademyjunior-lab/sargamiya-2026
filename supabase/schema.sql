-- SARGAMIYA 2026 — Supabase / PostgreSQL schema
-- ESRA Global Science Academy
-- Run this once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type student_category as enum (
    'Junior Boys',
    'Junior Girls',
    'Senior Boys',
    'Senior Girls'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type house_name as enum ('Atlas', 'Titan', 'Olympus');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_format as enum ('individual', 'relay', 'team');
exception when duplicate_object then null; end $$;

do $$ begin
  create type registration_status as enum ('registered', 'withdrawn', 'disqualified');
exception when duplicate_object then null; end $$;

do $$ begin
  create type result_status as enum ('official', 'disqualified', 'did_not_finish', 'did_not_start');
exception when duplicate_object then null; end $$;

-- ============================================================
-- HOUSES
-- ============================================================

create table if not exists houses (
  id uuid primary key default gen_random_uuid(),
  name house_name not null unique,
  display_order integer not null unique,
  created_at timestamptz not null default now()
);

insert into houses (name, display_order)
values
  ('Atlas', 1),
  ('Titan', 2),
  ('Olympus', 3)
on conflict (name) do nothing;

-- ============================================================
-- STUDENTS
-- Chest number is the operational participant identifier.
-- ============================================================

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  admission_no text unique,
  chest_no integer not null unique,
  name text not null,
  class_name text not null,
  division text,
  category student_category not null,
  gender text,
  house_id uuid references houses(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_chest_no_positive check (chest_no > 0)
);

create index if not exists idx_students_chest_no on students(chest_no);
create index if not exists idx_students_category on students(category);
create index if not exists idx_students_house on students(house_id);

-- ============================================================
-- EVENTS
-- Event definitions are category-specific.
-- The same event name can therefore exist for all four categories.
-- ============================================================

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  category student_category not null,
  name text not null,
  slug text not null,
  discipline text not null,
  format event_format not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(category, slug)
);

create index if not exists idx_events_category on events(category);

-- ============================================================
-- POINTING RULES
-- ============================================================

create table if not exists pointing_rules (
  id uuid primary key default gen_random_uuid(),
  event_format event_format not null unique,
  first_place integer not null,
  second_place integer not null,
  third_place integer not null,
  created_at timestamptz not null default now(),
  constraint pointing_nonnegative check (
    first_place >= 0 and second_place >= 0 and third_place >= 0
  )
);

insert into pointing_rules (event_format, first_place, second_place, third_place)
values
  ('individual', 5, 3, 1),
  ('relay', 10, 6, 4),
  ('team', 10, 6, 4)
on conflict (event_format) do update set
  first_place = excluded.first_place,
  second_place = excluded.second_place,
  third_place = excluded.third_place;

-- ============================================================
-- EVENT-SPECIFIC FORMAT OVERRIDE
-- Allows future event-specific individual or group scoring overrides.
-- Default is selected when the event is seeded.
-- ============================================================

alter table events
  add column if not exists scoring_format event_format;

-- ============================================================
-- REGISTRATIONS
-- One student can register once per event.
-- ============================================================

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  status registration_status not null default 'registered',
  registered_at timestamptz not null default now(),
  notes text,
  unique(student_id, event_id)
);

create index if not exists idx_registrations_student on registrations(student_id);
create index if not exists idx_registrations_event on registrations(event_id);

-- ============================================================
-- EVENT TEAMS
-- Used for group competitions.
-- ============================================================

create table if not exists event_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  house_id uuid not null references houses(id),
  team_name text,
  created_at timestamptz not null default now()
);

create table if not exists event_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references event_teams(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(team_id, student_id)
);

-- ============================================================
-- RESULTS
-- One official result per participant/team per event.
-- For individual events, student_id is used.
-- For relay/team events, team_id is used.
-- ============================================================

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  team_id uuid references event_teams(id) on delete cascade,
  position integer,
  result_value numeric,
  result_unit text,
  status result_status not null default 'official',
  points_awarded integer not null default 0,
  notes text,
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint results_one_subject check (
    (student_id is not null and team_id is null)
    or
    (student_id is null and team_id is not null)
  ),
  constraint results_position_positive check (
    position is null or position > 0
  ),
  constraint results_points_nonnegative check (points_awarded >= 0)
);

create unique index if not exists uq_results_event_student
  on results(event_id, student_id)
  where student_id is not null;

create unique index if not exists uq_results_event_team
  on results(event_id, team_id)
  where team_id is not null;

create index if not exists idx_results_event on results(event_id);
create index if not exists idx_results_student on results(student_id);

-- ============================================================
-- HOUSE POINT LEDGER
-- Every awarded score is recorded as a ledger entry.
-- This makes the tally auditable.
-- ============================================================

create table if not exists house_points (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references houses(id),
  event_id uuid references events(id),
  result_id uuid references results(id) on delete cascade,
  points integer not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint house_points_nonnegative check (points >= 0)
);

-- The generic manual House-points control records bonus rows without an event ID.
alter table house_points alter column event_id drop not null;

create unique index if not exists uq_house_points_result
  on house_points(result_id)
  where result_id is not null;

create index if not exists idx_house_points_house on house_points(house_id);

-- ============================================================
-- EVENT SCHEDULE
-- Scheduling is separate from the event definition.
-- ============================================================

create table if not exists event_schedule (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  scheduled_date date,
  start_time time,
  end_time time,
  venue text,
  notes text,
  created_at timestamptz not null default now(),
  unique(event_id)
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_students_updated_at on students;
create trigger trg_students_updated_at
before update on students
for each row execute function set_updated_at();

drop trigger if exists trg_results_updated_at on results;
create trigger trg_results_updated_at
before update on results
for each row execute function set_updated_at();

-- ============================================================
-- SEED EVENTS — SARGAMIYA 2026
-- 30 events for each boys category and 29 for each girls category = 118 records.
-- Burda Recitation and other group competitions use the team scoring and roster workflow.
-- ============================================================

insert into events (category, name, slug, discipline, format, scoring_format)
values
-- Senior Boys,
('Senior Boys','Pencil Drawing','pencil-drawing','Visual Arts','individual','individual'),
('Senior Boys','Water Colour','water-colour','Visual Arts','individual','individual'),
('Senior Boys','Calligraphy - Eng','calligraphy-eng','Visual Arts','individual','individual'),
('Senior Boys','Calligraphy - Mal','calligraphy-mal','Visual Arts','individual','individual'),
('Senior Boys','Calligraphy - Arab','calligraphy-arab','Visual Arts','individual','individual'),
('Senior Boys','Poem Writing - Eng','poem-writing-eng','Literary Arts','individual','individual'),
('Senior Boys','Poem Writing - Mal','poem-writing-mal','Literary Arts','individual','individual'),
('Senior Boys','Story Writing - Eng','story-writing-eng','Literary Arts','individual','individual'),
('Senior Boys','Story Writing - Mal','story-writing-mal','Literary Arts','individual','individual'),
('Senior Boys','Essay Writing - Eng','essay-writing-eng','Literary Arts','individual','individual'),
('Senior Boys','Essay Writing - Mal','essay-writing-mal','Literary Arts','individual','individual'),
('Senior Boys','Elocution - Eng','elocution-eng','Oratory','individual','individual'),
('Senior Boys','Elocution - Mal','elocution-mal','Oratory','individual','individual'),
('Senior Boys','Quran Recitation','quran-recitation','Recitation','individual','individual'),
('Senior Boys','Recitation - Eng','recitation-eng','Recitation','individual','individual'),
('Senior Boys','Recitation - Mal','recitation-mal','Recitation','individual','individual'),
('Senior Boys','Recitation - Hindi','recitation-hindi','Recitation','individual','individual'),
('Senior Boys','Mappilapattu','mappilapattu','Vocal Arts','individual','individual'),
('Senior Boys','Madh Song','madh-song','Vocal Arts','individual','individual'),
('Senior Boys','Kadha Prasangam','kadha-prasangam','Performing Arts','individual','individual'),
('Senior Boys','Maalapattu','maalapattu','Vocal Arts','individual','individual'),
('Senior Boys','Arabic Song','arabic-song','Vocal Arts','individual','individual'),
('Senior Boys','Group Song - Malayalam','group-song-malayalam','Group Vocal Arts','team','team'),
('Senior Boys','Group Song - English','group-song-english','Group Vocal Arts','team','team'),
('Senior Boys','Burda Recitation','burda-recitation','Recitation','team','team'),
('Senior Boys','Mappilapattu - Group','mappilapattu-group','Group Vocal Arts','team','team'),
('Senior Boys','Nadanpattu','nadanpattu','Group Vocal Arts','team','team'),
('Senior Boys','Vanchipattu','vanchipattu','Group Performing Arts','team','team'),
('Senior Boys','Qawali','qawali','Group Vocal Arts','team','team'),
('Senior Boys','Duff','duff','Group Performing Arts','team','team'),
-- Senior Girls,
('Senior Girls','Pencil Drawing','pencil-drawing','Visual Arts','individual','individual'),
('Senior Girls','Water Colour','water-colour','Visual Arts','individual','individual'),
('Senior Girls','Calligraphy - Eng','calligraphy-eng','Visual Arts','individual','individual'),
('Senior Girls','Calligraphy - Mal','calligraphy-mal','Visual Arts','individual','individual'),
('Senior Girls','Calligraphy - Arab','calligraphy-arab','Visual Arts','individual','individual'),
('Senior Girls','Poem Writing - Eng','poem-writing-eng','Literary Arts','individual','individual'),
('Senior Girls','Poem Writing - Mal','poem-writing-mal','Literary Arts','individual','individual'),
('Senior Girls','Story Writing - Eng','story-writing-eng','Literary Arts','individual','individual'),
('Senior Girls','Story Writing - Mal','story-writing-mal','Literary Arts','individual','individual'),
('Senior Girls','Essay Writing - Eng','essay-writing-eng','Literary Arts','individual','individual'),
('Senior Girls','Essay Writing - Mal','essay-writing-mal','Literary Arts','individual','individual'),
('Senior Girls','Elocution - Eng','elocution-eng','Oratory','individual','individual'),
('Senior Girls','Elocution - Mal','elocution-mal','Oratory','individual','individual'),
('Senior Girls','Quran Recitation','quran-recitation','Recitation','individual','individual'),
('Senior Girls','Recitation - Eng','recitation-eng','Recitation','individual','individual'),
('Senior Girls','Recitation - Mal','recitation-mal','Recitation','individual','individual'),
('Senior Girls','Recitation - Hindi','recitation-hindi','Recitation','individual','individual'),
('Senior Girls','Mappilapattu','mappilapattu','Vocal Arts','individual','individual'),
('Senior Girls','Madh Song','madh-song','Vocal Arts','individual','individual'),
('Senior Girls','Kadha Prasangam','kadha-prasangam','Performing Arts','individual','individual'),
('Senior Girls','Maalapattu','maalapattu','Vocal Arts','individual','individual'),
('Senior Girls','Arabic Song','arabic-song','Vocal Arts','individual','individual'),
('Senior Girls','Group Song - Malayalam','group-song-malayalam','Group Vocal Arts','team','team'),
('Senior Girls','Group Song - English','group-song-english','Group Vocal Arts','team','team'),
('Senior Girls','Burda Recitation','burda-recitation','Recitation','team','team'),
('Senior Girls','Mappilapattu - Group','mappilapattu-group','Group Vocal Arts','team','team'),
('Senior Girls','Nadanpattu','nadanpattu','Group Vocal Arts','team','team'),
('Senior Girls','Vanchipattu','vanchipattu','Group Performing Arts','team','team'),
('Senior Girls','Qawali','qawali','Group Vocal Arts','team','team'),
-- Junior Boys,
('Junior Boys','Pencil Drawing','pencil-drawing','Visual Arts','individual','individual'),
('Junior Boys','Water Colour','water-colour','Visual Arts','individual','individual'),
('Junior Boys','Calligraphy - Eng','calligraphy-eng','Visual Arts','individual','individual'),
('Junior Boys','Calligraphy - Mal','calligraphy-mal','Visual Arts','individual','individual'),
('Junior Boys','Calligraphy - Arab','calligraphy-arab','Visual Arts','individual','individual'),
('Junior Boys','Poem Writing - Eng','poem-writing-eng','Literary Arts','individual','individual'),
('Junior Boys','Poem Writing - Mal','poem-writing-mal','Literary Arts','individual','individual'),
('Junior Boys','Story Writing - Eng','story-writing-eng','Literary Arts','individual','individual'),
('Junior Boys','Story Writing - Mal','story-writing-mal','Literary Arts','individual','individual'),
('Junior Boys','Essay Writing - Eng','essay-writing-eng','Literary Arts','individual','individual'),
('Junior Boys','Essay Writing - Mal','essay-writing-mal','Literary Arts','individual','individual'),
('Junior Boys','Elocution - Eng','elocution-eng','Oratory','individual','individual'),
('Junior Boys','Elocution - Mal','elocution-mal','Oratory','individual','individual'),
('Junior Boys','Quran Recitation','quran-recitation','Recitation','individual','individual'),
('Junior Boys','Recitation - Eng','recitation-eng','Recitation','individual','individual'),
('Junior Boys','Recitation - Mal','recitation-mal','Recitation','individual','individual'),
('Junior Boys','Recitation - Hindi','recitation-hindi','Recitation','individual','individual'),
('Junior Boys','Mappilapattu','mappilapattu','Vocal Arts','individual','individual'),
('Junior Boys','Madh Song','madh-song','Vocal Arts','individual','individual'),
('Junior Boys','Kadha Prasangam','kadha-prasangam','Performing Arts','individual','individual'),
('Junior Boys','Maalapattu','maalapattu','Vocal Arts','individual','individual'),
('Junior Boys','Arabic Song','arabic-song','Vocal Arts','individual','individual'),
('Junior Boys','Group Song - Malayalam','group-song-malayalam','Group Vocal Arts','team','team'),
('Junior Boys','Group Song - English','group-song-english','Group Vocal Arts','team','team'),
('Junior Boys','Burda Recitation','burda-recitation','Recitation','team','team'),
('Junior Boys','Mappilapattu - Group','mappilapattu-group','Group Vocal Arts','team','team'),
('Junior Boys','Nadanpattu','nadanpattu','Group Vocal Arts','team','team'),
('Junior Boys','Vanchipattu','vanchipattu','Group Performing Arts','team','team'),
('Junior Boys','Qawali','qawali','Group Vocal Arts','team','team'),
('Junior Boys','Duff','duff','Group Performing Arts','team','team'),
-- Junior Girls,
('Junior Girls','Pencil Drawing','pencil-drawing','Visual Arts','individual','individual'),
('Junior Girls','Water Colour','water-colour','Visual Arts','individual','individual'),
('Junior Girls','Calligraphy - Eng','calligraphy-eng','Visual Arts','individual','individual'),
('Junior Girls','Calligraphy - Mal','calligraphy-mal','Visual Arts','individual','individual'),
('Junior Girls','Calligraphy - Arab','calligraphy-arab','Visual Arts','individual','individual'),
('Junior Girls','Poem Writing - Eng','poem-writing-eng','Literary Arts','individual','individual'),
('Junior Girls','Poem Writing - Mal','poem-writing-mal','Literary Arts','individual','individual'),
('Junior Girls','Story Writing - Eng','story-writing-eng','Literary Arts','individual','individual'),
('Junior Girls','Story Writing - Mal','story-writing-mal','Literary Arts','individual','individual'),
('Junior Girls','Essay Writing - Eng','essay-writing-eng','Literary Arts','individual','individual'),
('Junior Girls','Essay Writing - Mal','essay-writing-mal','Literary Arts','individual','individual'),
('Junior Girls','Elocution - Eng','elocution-eng','Oratory','individual','individual'),
('Junior Girls','Elocution - Mal','elocution-mal','Oratory','individual','individual'),
('Junior Girls','Quran Recitation','quran-recitation','Recitation','individual','individual'),
('Junior Girls','Recitation - Eng','recitation-eng','Recitation','individual','individual'),
('Junior Girls','Recitation - Mal','recitation-mal','Recitation','individual','individual'),
('Junior Girls','Recitation - Hindi','recitation-hindi','Recitation','individual','individual'),
('Junior Girls','Mappilapattu','mappilapattu','Vocal Arts','individual','individual'),
('Junior Girls','Madh Song','madh-song','Vocal Arts','individual','individual'),
('Junior Girls','Kadha Prasangam','kadha-prasangam','Performing Arts','individual','individual'),
('Junior Girls','Maalapattu','maalapattu','Vocal Arts','individual','individual'),
('Junior Girls','Arabic Song','arabic-song','Vocal Arts','individual','individual'),
('Junior Girls','Group Song - Malayalam','group-song-malayalam','Group Vocal Arts','team','team'),
('Junior Girls','Group Song - English','group-song-english','Group Vocal Arts','team','team'),
('Junior Girls','Burda Recitation','burda-recitation','Recitation','team','team'),
('Junior Girls','Mappilapattu - Group','mappilapattu-group','Group Vocal Arts','team','team'),
('Junior Girls','Nadanpattu','nadanpattu','Group Vocal Arts','team','team'),
('Junior Girls','Vanchipattu','vanchipattu','Group Performing Arts','team','team'),
('Junior Girls','Qawali','qawali','Group Vocal Arts','team','team')
on conflict (category, slug) do update set
  name = excluded.name,
  discipline = excluded.discipline,
  format = excluded.format,
  scoring_format = excluded.scoring_format;

-- Preserve any historical records, but retire Duff from girls' categories.
update events
set is_active = false
where lower(trim(name)) = 'duff'
  and category in ('Senior Girls', 'Junior Girls');

-- Correct Burda Recitation's group classification on existing installs too.
update events
set format = 'team',
    scoring_format = 'team'
where lower(trim(name)) = 'burda recitation';

-- ============================================================
-- READ-ONLY VIEWS
-- ============================================================

create or replace view student_directory as
select
  s.id,
  s.admission_no,
  s.chest_no,
  s.name,
  s.class_name,
  s.division,
  s.category,
  s.gender,
  h.name as house,
  s.is_active
from students s
left join houses h on h.id = s.house_id;

create or replace view house_points_tally as
select
  h.id as house_id,
  h.name as house,
  coalesce(sum(hp.points), 0)::integer as total_points
from houses h
left join house_points hp on hp.house_id = h.id
group by h.id, h.name, h.display_order
order by total_points desc, h.display_order;

-- ============================================================
-- ROW LEVEL SECURITY
-- Development-safe baseline. We will tighten this when
-- authentication/roles are implemented.
-- ============================================================

alter table houses enable row level security;
alter table students enable row level security;
alter table events enable row level security;
alter table pointing_rules enable row level security;
alter table registrations enable row level security;
alter table event_teams enable row level security;
alter table event_team_members enable row level security;
alter table results enable row level security;
alter table house_points enable row level security;
alter table event_schedule enable row level security;

-- Public read access for the catalogue/tally during development.
do $$ begin
  create policy "public read houses" on houses for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public read events" on events for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public read pointing rules" on pointing_rules for select using (true);
exception when duplicate_object then null; end $$;

-- Student/results writes should be authenticated once auth is added.
-- Do NOT expose unrestricted public write policies.

-- ============================================================
-- END
-- ============================================================
