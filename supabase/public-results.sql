-- SARGAMIYA 2026 — Public Results Portal
-- Run after schema.sql, results-and-points.sql and live-dashboard.sql.
-- Public views intentionally expose only official result information needed
-- for the championship results portal. Admission numbers, class/division,
-- registrations and internal IDs are not exposed.

create or replace view public.athlon_public_results as
select
  r.id as result_id,
  r.event_id,
  e.category,
  e.discipline,
  e.name as event_name,
  coalesce(e.scoring_format, e.format) as event_format,
  r.position,
  r.result_value,
  r.result_unit,
  r.points_awarded,
  case
    when r.student_id is not null then s.name
    else coalesce(et.team_name, h.name || ' Team')
  end as participant_name,
  case when r.student_id is not null then s.chest_no else null end as chest_no,
  h.name as house,
  r.updated_at
from public.results r
join public.events e on e.id = r.event_id
left join public.students s on s.id = r.student_id
left join public.event_teams et on et.id = r.team_id
left join public.houses h on h.id = case
  when s.house_id is not null then s.house_id
  when et.house_id is not null then et.house_id
end
where r.status = 'official'
  and e.is_active = true;

revoke all on public.athlon_public_results from anon, authenticated;
grant select on public.athlon_public_results to anon, authenticated;

create or replace view public.athlon_public_event_catalogue as
select
  e.id as event_id,
  e.category,
  e.name as event_name,
  e.discipline,
  coalesce(e.scoring_format, e.format) as event_format,
  e.is_active,
  count(r.id) filter (where r.status = 'official')::integer as official_results,
  max(r.updated_at) filter (where r.status = 'official') as last_result_at
from public.events e
left join public.results r on r.event_id = e.id
where e.is_active = true
group by e.id, e.category, e.name, e.discipline, e.scoring_format, e.format, e.is_active;

revoke all on public.athlon_public_event_catalogue from anon, authenticated;
grant select on public.athlon_public_event_catalogue to anon, authenticated;

create or replace view public.athlon_public_event_schedule as
select
  es.event_id,
  e.category,
  e.name as event_name,
  e.discipline,
  es.scheduled_date,
  es.start_time,
  es.end_time,
  es.venue
from public.event_schedule es
join public.events e on e.id = es.event_id
where e.is_active = true;

revoke all on public.athlon_public_event_schedule from anon, authenticated;
grant select on public.athlon_public_event_schedule to anon, authenticated;

-- Allow the public portal to receive live notifications when official results
-- or house points change. The portal still reads only the aggregate/public views.
do $$
begin
  alter publication supabase_realtime add table public.results;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
