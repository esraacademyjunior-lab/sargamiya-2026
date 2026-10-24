-- SARGAMIYA 2026 — Live Public House Points Dashboard
-- Run after schema.sql and results-and-points.sql.

-- Public scoreboard views expose aggregate information only.
-- No student names, chest numbers, registrations, or raw results are exposed.

create or replace view public.athlon_public_house_tally as
select
  h.id as house_id,
  h.name as house,
  coalesce(sum(hp.points), 0)::integer as total_points,
  coalesce(max(hp.created_at), null) as last_points_at
from public.houses h
left join public.house_points hp on hp.house_id = h.id
group by h.id, h.name, h.display_order
order by total_points desc, h.display_order;

revoke all on public.athlon_public_house_tally from anon, authenticated;
grant select on public.athlon_public_house_tally to anon, authenticated;

create or replace view public.athlon_public_event_status as
select
  e.id as event_id,
  e.category,
  e.name as event_name,
  coalesce(e.scoring_format, e.format) as event_format,
  count(r.id) filter (where r.status = 'official')::integer as official_results,
  coalesce(max(r.updated_at), max(r.entered_at)) as last_result_at
from public.events e
left join public.results r on r.event_id = e.id
group by e.id, e.category, e.name, e.scoring_format, e.format;

revoke all on public.athlon_public_event_status from anon, authenticated;
grant select on public.athlon_public_event_status to anon, authenticated;

create or replace view public.athlon_public_dashboard_summary as
select
  (select count(*)::integer from public.students where is_active = true) as active_students,
  (select count(*)::integer from public.events where is_active = true) as total_events,
  (select count(distinct event_id)::integer from public.results where status = 'official') as completed_events,
  (select coalesce(sum(points), 0)::integer from public.house_points) as total_points,
  (select max(created_at) from public.house_points) as last_points_update;

revoke all on public.athlon_public_dashboard_summary from anon, authenticated;
grant select on public.athlon_public_dashboard_summary to anon, authenticated;

-- Enable realtime notifications for the public aggregate refresh trigger source.
-- This does not expose student information by itself; the dashboard still reads
-- only aggregate views.
do $$
begin
  alter publication supabase_realtime add table public.house_points;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Keep the ledger synchronized if an official result is deleted.
create or replace function public.remove_athlon_house_points_on_result_delete()
returns trigger
language plpgsql
as $$
begin
  delete from public.house_points where result_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_remove_athlon_house_points on public.results;
create trigger trg_remove_athlon_house_points
after delete on public.results
for each row execute function public.remove_athlon_house_points_on_result_delete();
