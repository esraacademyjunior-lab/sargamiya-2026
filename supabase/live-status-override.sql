-- SARGAMIYA 2026 — automatic schedule status with administrator override
-- Run once in Supabase SQL Editor after schema.sql and public-schedule.sql.
create table if not exists public.live_event_control (
  id integer primary key default 1 check (id = 1),
  mode text not null default 'auto' check (mode in ('auto','manual')),
  current_event_id uuid null references public.events(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled','live','delayed','paused','completed','announcement')),
  message text null,
  updated_at timestamptz not null default now()
);
insert into public.live_event_control (id, mode, status)
values (1, 'auto', 'scheduled') on conflict (id) do nothing;
alter table public.live_event_control enable row level security;
drop policy if exists "Public can read live event control" on public.live_event_control;
create policy "Public can read live event control" on public.live_event_control for select to anon, authenticated using (true);
drop policy if exists "Authenticated admins manage live event control" on public.live_event_control;
create policy "Authenticated admins manage live event control" on public.live_event_control for all to authenticated using (true) with check (true);
revoke all on public.live_event_control from anon;
grant select on public.live_event_control to anon, authenticated;
grant select, insert, update, delete on public.live_event_control to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.live_event_control;
exception when duplicate_object then null; when undefined_object then null; end $$;
