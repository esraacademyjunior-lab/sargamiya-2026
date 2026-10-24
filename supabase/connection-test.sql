-- Run this only if the Supabase connection test page reports
-- "permission denied for table events".
-- It exposes the event catalogue for public READ access, which is
-- acceptable for this catalogue but should not be copied to students/results.

alter table events enable row level security;

drop policy if exists "public read events" on events;

create policy "public read events"
on events
for select
using (true);
