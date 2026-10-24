-- Sargamiya Live event photographs
create table if not exists public.live_highlights (
  id uuid primary key default gen_random_uuid(),
  title text,
  event_name text,
  photo_url text not null,
  storage_path text not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists live_highlights_published_created_idx
  on public.live_highlights (is_published, created_at desc);
alter table public.live_highlights enable row level security;
drop policy if exists "Public can view published live highlights" on public.live_highlights;
create policy "Public can view published live highlights" on public.live_highlights
  for select using (is_published = true);
drop policy if exists "Authenticated users can manage live highlights" on public.live_highlights;
create policy "Authenticated users can manage live highlights" on public.live_highlights
  for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sargamiya-live-highlights', 'sargamiya-live-highlights', true, 12582912,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 12582912,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];
drop policy if exists "Public can view Sargamiya live highlight photos" on storage.objects;
create policy "Public can view Sargamiya live highlight photos" on storage.objects
  for select using (bucket_id = 'sargamiya-live-highlights');
drop policy if exists "Authenticated users can upload Sargamiya live highlight photos" on storage.objects;
create policy "Authenticated users can upload Sargamiya live highlight photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'sargamiya-live-highlights');
drop policy if exists "Authenticated users can delete Sargamiya live highlight photos" on storage.objects;
create policy "Authenticated users can delete Sargamiya live highlight photos" on storage.objects
  for delete to authenticated using (bucket_id = 'sargamiya-live-highlights');
