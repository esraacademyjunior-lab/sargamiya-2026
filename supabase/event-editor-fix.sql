-- SARGAMIYA 2026 — Event Editor Fix
-- Run once in Supabase SQL Editor on an existing project.
-- Fixes two common reasons changing an event from Individual to Group fails:
--   1) Older databases may not have the `team` enum value.
--   2) RLS may allow reading the event catalogue but not editing it.
-- This migration does not change existing event rows. Retry the edit after it succeeds.

alter type public.event_format add value if not exists 'team';

alter table public.events enable row level security;

drop policy if exists "authenticated manage events" on public.events;
drop policy if exists "Authenticated users can manage events" on public.events;
create policy "authenticated manage events"
on public.events
for all
to authenticated
using (true)
with check (true);
