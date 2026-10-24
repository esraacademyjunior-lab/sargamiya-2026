-- SARGAMIYA 2026 — Results & Automatic Points
-- Run after the base schema and authenticated RLS migrations.

alter table public.results enable row level security;
alter table public.house_points enable row level security;

drop policy if exists "Authenticated users can manage results" on public.results;
create policy "Authenticated users can manage results"
on public.results
for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated users can view house points" on public.house_points;
create policy "Authenticated users can view house points"
on public.house_points
for select to authenticated
using (true);

drop policy if exists "Authenticated users can manage house points" on public.house_points;
create policy "Authenticated users can manage house points"
on public.house_points
for all to authenticated
using (true) with check (true);

-- Replace any old point-sync triggers/functions from previous versions.
drop trigger if exists trg_sync_athlon_result_points on public.results;
drop trigger if exists trg_validate_athlon_result on public.results;

create or replace function public.calculate_athlon_points(
  p_format public.event_format,
  p_position integer,
  p_status public.result_status
)
returns integer
language plpgsql
immutable
as $$
begin
  if p_status <> 'official' or p_position is null then
    return 0;
  end if;

  if p_format = 'individual' then
    return case p_position
      when 1 then 5
      when 2 then 3
      when 3 then 1
      else 0
    end;
  end if;

  return case p_position
    when 1 then 10
    when 2 then 6
    when 3 then 4
    else 0
  end;
end;
$$;

create or replace function public.validate_and_score_athlon_result()
returns trigger
language plpgsql
as $$
declare
  v_event record;
  v_student record;
  v_team record;
  v_format public.event_format;
  v_house_id uuid;
  v_existing_count integer;
begin
  select e.id, e.category, e.name, e.format, e.scoring_format
    into v_event
    from public.events e
   where e.id = new.event_id;

  if v_event.id is null then
    raise exception 'The selected event does not exist.';
  end if;

  v_format := coalesce(v_event.scoring_format, v_event.format);

  if new.status = 'official' and (new.position is null or new.position < 1) then
    raise exception 'An official result must have a position.';
  end if;

  if new.position is not null and new.position < 1 then
    raise exception 'Position must be 1 or greater.';
  end if;

  if v_format = 'individual' then
    if new.student_id is null or new.team_id is not null then
      raise exception 'Individual events require a student result.';
    end if;

    select s.id, s.category, s.house_id, s.is_active
      into v_student
      from public.students s
     where s.id = new.student_id;

    if v_student.id is null or not v_student.is_active then
      raise exception 'The selected student is not active.';
    end if;

    if v_student.category::text <> v_event.category::text then
      raise exception 'Student category does not match event category.';
    end if;

    if v_student.house_id is null then
      raise exception 'The student must have a House before a result can be entered.';
    end if;

    if not exists (
      select 1
        from public.registrations r
       where r.student_id = new.student_id
         and r.event_id = new.event_id
         and r.status = 'registered'
    ) then
      raise exception 'Student is not registered for this event.';
    end if;

    v_house_id := v_student.house_id;

  else
    if new.team_id is null or new.student_id is not null then
      raise exception 'Relay and team events require a team result.';
    end if;

    select et.id, et.event_id, et.house_id, et.is_active
      into v_team
      from public.event_teams et
     where et.id = new.team_id;

    if v_team.id is null or not v_team.is_active then
      raise exception 'The selected team is not active.';
    end if;

    if v_team.event_id <> new.event_id then
      raise exception 'Team does not belong to the selected event.';
    end if;

    select count(*) into v_existing_count
      from public.event_team_members etm
     where etm.team_id = new.team_id;

    if v_existing_count = 0 then
      raise exception 'A team must have at least one member before a result can be entered.';
    end if;

    v_house_id := v_team.house_id;
  end if;

  new.points_awarded := public.calculate_athlon_points(
    v_format,
    new.position,
    new.status
  );

  return new;
end;
$$;

create trigger trg_validate_athlon_result
before insert or update on public.results
for each row execute function public.validate_and_score_athlon_result();

create or replace function public.sync_athlon_house_points()
returns trigger
language plpgsql
as $$
declare
  v_event_id uuid;
  v_house_id uuid;
begin
  delete from public.house_points where result_id = new.id;

  if new.points_awarded > 0 then
    select
      e.id,
      case
        when coalesce(e.scoring_format, e.format) = 'individual' then s.house_id
        else et.house_id
      end
      into v_event_id, v_house_id
      from public.events e
      left join public.students s on s.id = new.student_id
      left join public.event_teams et on et.id = new.team_id
     where e.id = new.event_id;

    if v_house_id is null then
      raise exception 'Unable to determine the House for this result.';
    end if;

    insert into public.house_points (
      house_id, event_id, result_id, points, reason
    )
    values (
      v_house_id,
      new.event_id,
      new.id,
      new.points_awarded,
      format('%s — %s place', (select name from public.events where id = new.event_id), new.position)
    );
  end if;

  return new;
end;
$$;

create trigger trg_sync_athlon_result_points
after insert or update on public.results
for each row execute function public.sync_athlon_house_points();

-- Useful read-only view for the results screen and later reports.
create or replace view public.athlon_results_detail as
select
  r.id,
  r.event_id,
  e.category,
  e.name as event_name,
  coalesce(e.scoring_format, e.format) as event_format,
  r.student_id,
  s.chest_no,
  s.name as student_name,
  s.class_name,
  s.division,
  r.team_id,
  et.team_name,
  h.name as house,
  r.position,
  r.result_value,
  r.result_unit,
  r.status,
  r.points_awarded,
  r.notes,
  r.entered_at,
  r.updated_at
from public.results r
join public.events e on e.id = r.event_id
left join public.students s on s.id = r.student_id
left join public.event_teams et on et.id = r.team_id
left join public.houses h
  on h.id = case
    when s.house_id is not null then s.house_id
    else et.house_id
  end;

revoke all on public.athlon_results_detail from anon;
grant select on public.athlon_results_detail to authenticated;

-- Live tally view, now sourced from the audited point ledger.
create or replace view public.athlon_house_tally as
select
  h.id as house_id,
  h.name as house,
  coalesce(sum(hp.points), 0)::integer as total_points
from public.houses h
left join public.house_points hp on hp.house_id = h.id
group by h.id, h.name, h.display_order
order by total_points desc, h.display_order;

revoke all on public.athlon_house_tally from anon;
grant select on public.athlon_house_tally to authenticated;
