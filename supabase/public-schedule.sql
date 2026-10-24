-- SARGAMIYA 2026 — Public Schedule + Admin Schedule Management

create or replace view public.athlon_public_schedule
with (security_invoker = true)
as
select
  es.id as schedule_id,
  es.event_id,
  e.category::text as category,
  e.name as event_name,
  e.discipline,
  coalesce(e.scoring_format, e.format)::text as format,
  es.scheduled_date,
  es.start_time,
  es.end_time,
  es.venue,
  es.notes
from public.event_schedule es
join public.events e on e.id = es.event_id
where e.is_active = true;

-- Public visitors may read the published schedule only.
alter view public.athlon_public_schedule owner to postgres;
grant select on public.athlon_public_schedule to anon, authenticated;

-- RLS for schedule table: only authenticated admins can manage entries.
alter table public.event_schedule enable row level security;

drop policy if exists "Authenticated users can manage event schedule" on public.event_schedule;
create policy "Authenticated users can manage event schedule"
on public.event_schedule
for all
to authenticated
using (true)
with check (true);

-- Public access to the base schedule table is intentionally not granted.
revoke all on public.event_schedule from anon;
revoke insert, update, delete on public.event_schedule from anon;
grant select on public.event_schedule to authenticated;
grant insert, update, delete on public.event_schedule to authenticated;
