-- SECURITY PLAN — DO NOT RUN UNTIL SUPABASE AUTH IS ENABLED.
-- Once admin authentication is in place, enable RLS and restrict student
-- data to authenticated administrators.
alter table students enable row level security;
alter table registrations enable row level security;
alter table results enable row level security;
alter table event_teams enable row level security;
alter table event_team_members enable row level security;
-- Add role-based policies after the admin auth flow is implemented.
