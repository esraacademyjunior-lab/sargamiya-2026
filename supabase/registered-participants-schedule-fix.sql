-- SARGAMIYA 2026 — Fix registered participant counts on the public Schedule page
-- Run this script in Supabase SQL Editor.
--
-- The web app stores registrations in public.registrations. These views expose
-- only active event registrations and the fields used by the public participant
-- list; the aggregate view lets the schedule show counts without downloading
-- every participant row just to count them.

-- Drop the aggregate first because it depends on the participant view.
drop view if exists public.athlon_public_event_participant_counts;
drop view if exists public.athlon_public_event_participants;

create view public.athlon_public_event_participants
with (security_barrier = true)
as
select
  r.event_id,
  s.id as student_id,
  s.id as id,
  s.name,
  s.admission_no,
  s.chest_no,
  s.class_name,
  s.division,
  coalesce(h.name::text, 'Unassigned') as house
from public.registrations r
join public.students s
  on s.id = r.student_id
join public.events e
  on e.id = r.event_id
left join public.houses h
  on h.id = s.house_id
where r.status = 'registered'
  and e.is_active = true;

-- This view is intentionally an aggregate: one row per event with at least
-- one registered participant. The frontend treats an absent row as zero.
create view public.athlon_public_event_participant_counts
with (security_barrier = true)
as
select
  event_id,
  count(*)::integer as participant_count
from public.athlon_public_event_participants
group by event_id;

-- The views run with their owner's privileges, so public visitors do not need
-- direct SELECT permissions on registrations or students.
alter view public.athlon_public_event_participants owner to postgres;
alter view public.athlon_public_event_participant_counts owner to postgres;

revoke all on public.athlon_public_event_participants from public, anon, authenticated;
revoke all on public.athlon_public_event_participant_counts from public, anon, authenticated;
grant select on public.athlon_public_event_participants to anon, authenticated;
grant select on public.athlon_public_event_participant_counts to anon, authenticated;
