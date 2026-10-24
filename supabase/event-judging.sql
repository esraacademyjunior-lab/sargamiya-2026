-- SARGAMIYA 2026 — Event-wise Participant Import, 3-Judge Scoring and Consolidation
-- Run once in the Supabase SQL Editor after schema.sql and team-management.sql.

create table if not exists public.event_judgement_scores (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  judge_no smallint not null check (judge_no between 1 and 3),
  entry_type text not null check (entry_type in ('student', 'team')),
  subject_key uuid not null,
  student_id uuid references public.students(id) on delete cascade,
  team_id uuid references public.event_teams(id) on delete cascade,
  indicator_1 numeric(10,2) not null check (indicator_1 >= 0),
  indicator_2 numeric(10,2) not null check (indicator_2 >= 0),
  indicator_3 numeric(10,2) not null check (indicator_3 >= 0),
  indicator_4 numeric(10,2) not null check (indicator_4 >= 0),
  indicator_5 numeric(10,2) not null check (indicator_5 >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_judgement_scores_subject_check check (
    (entry_type = 'student' and student_id is not null and team_id is null and subject_key = student_id)
    or
    (entry_type = 'team' and team_id is not null and student_id is null and subject_key = team_id)
  ),
  constraint event_judgement_scores_unique_subject_per_judge
    unique (event_id, judge_no, subject_key)
);

create index if not exists idx_event_judgement_scores_event
  on public.event_judgement_scores(event_id);
create index if not exists idx_event_judgement_scores_judge
  on public.event_judgement_scores(event_id, judge_no);

alter table public.event_judgement_scores enable row level security;
revoke all on public.event_judgement_scores from anon;
grant select, insert, update, delete on public.event_judgement_scores to authenticated;

drop policy if exists "Authenticated users can manage event judgement scores"
  on public.event_judgement_scores;
create policy "Authenticated users can manage event judgement scores"
  on public.event_judgement_scores
  for all to authenticated
  using (true) with check (true);

-- Ensure the group entry screen can filter active teams on existing deployments.
alter table public.event_teams
  add column if not exists is_active boolean not null default true;
