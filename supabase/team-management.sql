-- SARGAMIYA 2026 — Group Roster Management
-- Run after the base schema, authentication RLS, and event catalogue migrations.

alter table public.event_teams
  add column if not exists is_active boolean not null default true;

alter table public.event_team_members
  add column if not exists member_order integer;

create index if not exists idx_event_teams_event on public.event_teams(event_id);
create index if not exists idx_event_teams_house on public.event_teams(house_id);
create index if not exists idx_event_team_members_team on public.event_team_members(team_id);
create index if not exists idx_event_team_members_student on public.event_team_members(student_id);

-- Authenticated administrators can manage team rosters.
alter table public.event_teams enable row level security;
alter table public.event_team_members enable row level security;

drop policy if exists "Authenticated users can manage event teams" on public.event_teams;
create policy "Authenticated users can manage event teams"
on public.event_teams
for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated users can manage event team members" on public.event_team_members;
create policy "Authenticated users can manage event team members"
on public.event_team_members
for all to authenticated
using (true) with check (true);

-- Validate every team member against the event registration, category and house.
-- Also prevents a student from being placed in two teams for the same event.
create or replace function public.validate_athlon_team_member()
returns trigger
language plpgsql
as $$
declare
  v_event record;
  v_team record;
  v_student record;
  v_member_count integer;
  v_existing integer;
  v_max_members integer;
begin
  select e.id, e.category, e.format, e.scoring_format, e.name
    into v_event
    from public.events e
   where e.id = (select et.event_id from public.event_teams et where et.id = new.team_id);

  if v_event.id is null then
    raise exception 'The selected team is not linked to a valid event.';
  end if;

  if coalesce(v_event.scoring_format, v_event.format) not in ('relay','team') then
    raise exception 'Only group-format events can have group rosters.';
  end if;

  select et.id, et.event_id, et.house_id, et.is_active
    into v_team
    from public.event_teams et
   where et.id = new.team_id;

  if not v_team.is_active then
    raise exception 'This team is inactive.';
  end if;

  select s.id, s.category, s.house_id, s.is_active
    into v_student
    from public.students s
   where s.id = new.student_id;

  if v_student.id is null or not v_student.is_active then
    raise exception 'The selected student is not active.';
  end if;

  if v_student.category::text <> v_event.category::text then
    raise exception 'Student category (%) does not match event category (%).', v_student.category, v_event.category;
  end if;

  if v_student.house_id is null or v_student.house_id <> v_team.house_id then
    raise exception 'Student house must match the team house.';
  end if;

  if not exists (
    select 1 from public.registrations r
     where r.student_id = new.student_id
       and r.event_id = v_team.event_id
       and r.status = 'registered'
  ) then
    raise exception 'Student is not registered for this event.';
  end if;

  select count(*) into v_existing
    from public.event_team_members etm
    join public.event_teams other_team on other_team.id = etm.team_id
   where other_team.event_id = v_team.event_id
     and etm.student_id = new.student_id
     and other_team.is_active = true
     and etm.team_id <> new.team_id;

  if v_existing > 0 then
    raise exception 'Student is already assigned to another team for this event.';
  end if;

  if coalesce(v_event.scoring_format, v_event.format) = 'relay' then
    v_max_members := 4;
  else
    v_max_members := null;
  end if;

  select count(*) into v_member_count
    from public.event_team_members etm
   where etm.team_id = new.team_id
     and etm.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_max_members is not null and v_member_count >= v_max_members then
    raise exception 'This % event allows a maximum of % group members.', v_event.name, v_max_members;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_athlon_team_member on public.event_team_members;
create trigger trg_validate_athlon_team_member
before insert or update on public.event_team_members
for each row execute function public.validate_athlon_team_member();

-- Keep team names useful and prevent an empty name.
alter table public.event_teams
  drop constraint if exists event_teams_team_name_nonempty;

alter table public.event_teams
  add constraint event_teams_team_name_nonempty
  check (team_name is null or length(trim(team_name)) > 0);

-- Helpful view for admin screens and future results pages.
create or replace view public.athlon_team_roster as
select
  et.id as team_id,
  et.event_id,
  e.category,
  e.name as event_name,
  coalesce(e.scoring_format, e.format) as event_format,
  et.house_id,
  h.name as house,
  et.team_name,
  et.is_active,
  etm.id as member_id,
  etm.student_id,
  s.chest_no,
  s.name as student_name,
  s.class_name,
  s.division,
  etm.member_order
from public.event_teams et
join public.events e on e.id = et.event_id
join public.houses h on h.id = et.house_id
left join public.event_team_members etm on etm.team_id = et.id
left join public.students s on s.id = etm.student_id;

-- The view is only useful to authenticated admin pages.
revoke all on public.athlon_team_roster from anon;
grant select on public.athlon_team_roster to authenticated;
