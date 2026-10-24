-- SARGAMIYA 2026: repair authenticated admin access for student imports.
-- Run this once in Supabase SQL Editor if student inserts fail with
-- "new row violates row-level security policy for table students".
--
-- This keeps RLS ENABLED and grants no anon/public insert access.
-- All Supabase Auth users can manage student rows; only create Auth accounts
-- for trusted Sargamiya administrators unless a stricter role model is added.

begin;

alter table public.students enable row level security;

drop policy if exists "authenticated read students" on public.students;
drop policy if exists "authenticated insert students" on public.students;
drop policy if exists "authenticated update students" on public.students;
drop policy if exists "authenticated delete students" on public.students;

create policy "authenticated read students"
  on public.students for select to authenticated
  using (true);

create policy "authenticated insert students"
  on public.students for insert to authenticated
  with check (true);

create policy "authenticated update students"
  on public.students for update to authenticated
  using (true) with check (true);

create policy "authenticated delete students"
  on public.students for delete to authenticated
  using (true);

commit;
