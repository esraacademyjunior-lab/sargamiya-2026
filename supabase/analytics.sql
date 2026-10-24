-- SARGAMIYA 2026 — Championship Analytics
-- Run after schema.sql and results-and-points.sql.

-- House performance by category, using official result points.
create or replace view public.athlon_analytics_house_category as
select
  h.id as house_id,
  h.name as house,
  c.category,
  coalesce(sum(hp.points), 0)::integer as points,
  count(distinct hp.event_id)::integer as events_scored
from public.houses h
cross join (select unnest(enum_range(null::student_category)) as category) c
left join public.students s
  on s.house_id = h.id and s.category = c.category and s.is_active = true
left join public.house_points hp
  on hp.house_id = h.id and hp.event_id in (
    select id from public.events where category = c.category
  )
left join public.events e on e.id = hp.event_id
where s.id is not null or e.category = c.category
 group by h.id, h.name, c.category;

revoke all on public.athlon_analytics_house_category from anon;
grant select on public.athlon_analytics_house_category to authenticated;

-- Event-wise official results, including the student/team identity for admins.
create or replace view public.athlon_analytics_event_results as
select
  r.id,
  r.event_id,
  e.category,
  e.discipline,
  e.name as event_name,
  coalesce(e.scoring_format, e.format) as event_format,
  r.position,
  r.result_value,
  r.result_unit,
  r.status,
  r.points_awarded,
  r.student_id,
  s.chest_no,
  s.name as student_name,
  s.class_name,
  s.division,
  r.team_id,
  et.team_name,
  h.name as house,
  r.entered_at,
  r.updated_at
from public.results r
join public.events e on e.id = r.event_id
left join public.students s on s.id = r.student_id
left join public.event_teams et on et.id = r.team_id
left join public.houses h on h.id = case when s.house_id is not null then s.house_id else et.house_id end
where r.status = 'official';

revoke all on public.athlon_analytics_event_results from anon;
grant select on public.athlon_analytics_event_results to authenticated;

-- Student performance summary. Only students with official points are included.
create or replace view public.athlon_analytics_student_performance as
select
  s.id as student_id,
  s.chest_no,
  s.name as student_name,
  s.class_name,
  s.division,
  s.category,
  h.name as house,
  count(distinct r.event_id)::integer as official_events,
  count(*) filter (where r.position = 1)::integer as gold,
  count(*) filter (where r.position = 2)::integer as silver,
  count(*) filter (where r.position = 3)::integer as bronze,
  coalesce(sum(r.points_awarded), 0)::integer as points
from public.students s
join public.houses h on h.id = s.house_id
left join public.results r on r.student_id = s.id and r.status = 'official'
group by s.id, s.chest_no, s.name, s.class_name, s.division, s.category, h.name;

revoke all on public.athlon_analytics_student_performance from anon;
grant select on public.athlon_analytics_student_performance to authenticated;

-- House medal table.
create or replace view public.athlon_analytics_house_medals as
select
  h.id as house_id,
  h.name as house,
  count(*) filter (where r.position = 1)::integer as gold,
  count(*) filter (where r.position = 2)::integer as silver,
  count(*) filter (where r.position = 3)::integer as bronze,
  count(*) filter (where r.position between 1 and 3)::integer as total_medals,
  coalesce(sum(r.points_awarded), 0)::integer as points
from public.houses h
left join public.results r on r.status = 'official'
left join public.students s on s.id = r.student_id and s.house_id = h.id
left join public.event_teams et on et.id = r.team_id and et.house_id = h.id
where (s.house_id = h.id or et.house_id = h.id)
group by h.id, h.name;

revoke all on public.athlon_analytics_house_medals from anon;
grant select on public.athlon_analytics_house_medals to authenticated;
