-- SARGAMIYA 2026 — Registration RLS
-- Run this only if the registrations policy has not already been created.

alter table public.registrations enable row level security;

drop policy if exists "Authenticated users can manage registrations" on public.registrations;
create policy "Authenticated users can manage registrations"
on public.registrations
for all
to authenticated
using (true)
with check (true);
