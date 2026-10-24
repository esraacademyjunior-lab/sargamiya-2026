-- SARGAMIYA 2026 admin RLS
-- Run this only after creating at least one admin user in Supabase Auth.
-- The application currently treats authenticated accounts as administrators.
-- Keep the Auth user list private and only create accounts for trusted staff.

alter table students enable row level security;
alter table registrations enable row level security;
alter table results enable row level security;
alter table event_teams enable row level security;
alter table event_team_members enable row level security;
alter table house_points enable row level security;
alter table event_schedule enable row level security;
alter table houses enable row level security;
alter table pointing_rules enable row level security;

-- Remove older development policies if they exist.
drop policy if exists "authenticated read students" on students;
drop policy if exists "authenticated insert students" on students;
drop policy if exists "authenticated update students" on students;
drop policy if exists "authenticated delete students" on students;

create policy "authenticated read students" on students for select to authenticated using (true);
create policy "authenticated insert students" on students for insert to authenticated with check (true);
create policy "authenticated update students" on students for update to authenticated using (true) with check (true);
create policy "authenticated delete students" on students for delete to authenticated using (true);

-- Read access to reference data for authenticated admins.
drop policy if exists "authenticated read houses" on houses;
create policy "authenticated read houses" on houses for select to authenticated using (true);

drop policy if exists "authenticated read pointing rules" on pointing_rules;
create policy "authenticated read pointing rules" on pointing_rules for select to authenticated using (true);

-- Operational tables: authenticated admins can manage them.
drop policy if exists "authenticated manage registrations" on registrations;
create policy "authenticated manage registrations" on registrations for all to authenticated using (true) with check (true);
create policy "authenticated manage results" on results for all to authenticated using (true) with check (true);
create policy "authenticated manage event teams" on event_teams for all to authenticated using (true) with check (true);
create policy "authenticated manage event team members" on event_team_members for all to authenticated using (true) with check (true);
create policy "authenticated manage house points" on house_points for all to authenticated using (true) with check (true);
create policy "authenticated manage event schedule" on event_schedule for all to authenticated using (true) with check (true);
