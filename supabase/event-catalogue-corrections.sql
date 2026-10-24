-- SARGAMIYA 2026: Correct Burda Recitation and Duff eligibility.
-- Run once in Supabase SQL Editor on an existing project.
-- Duff rows in girls' categories are soft-disabled to preserve any historical registrations/results.
begin;

update events
set format = 'team',
    scoring_format = 'team'
where lower(trim(name)) = 'burda recitation'
  and category in ('Senior Boys', 'Senior Girls', 'Junior Boys', 'Junior Girls');

update events
set is_active = false
where lower(trim(name)) = 'duff'
  and category in ('Senior Girls', 'Junior Girls');

update events
set is_active = true,
    format = 'team',
    scoring_format = 'team'
where lower(trim(name)) = 'duff'
  and category in ('Senior Boys', 'Junior Boys');

commit;
