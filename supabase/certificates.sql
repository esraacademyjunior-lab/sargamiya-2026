-- SARGAMIYA 2026 — Certificate issuance, verification and revocation
-- Run after schema.sql, results-and-points.sql, public-results.sql and admin-rls.sql.

create sequence if not exists public.sargamiya_certificate_number_seq start with 1 increment by 1;

create table if not exists public.athlon_certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_no text not null unique,
  result_id uuid not null references public.results(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(result_id, student_id)
);

create index if not exists idx_athlon_certificates_result on public.athlon_certificates(result_id);
create index if not exists idx_athlon_certificates_student on public.athlon_certificates(student_id);
create index if not exists idx_athlon_certificates_no on public.athlon_certificates(certificate_no);

alter table public.athlon_certificates enable row level security;
revoke all on public.athlon_certificates from anon, authenticated;

drop policy if exists "Authenticated users can manage certificates" on public.athlon_certificates;
create policy "Authenticated users can manage certificates"
on public.athlon_certificates for all to authenticated using (true) with check (true);

create or replace function public.create_athlon_certificate(
  p_result_id uuid,
  p_student_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result record;
  v_student record;
  v_certificate_no text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to issue certificates.';
  end if;

  select r.id, r.event_id, r.student_id, r.team_id, r.position, r.status,
         e.name as event_name, e.category::text as category, e.is_active
    into v_result
    from public.results r
    join public.events e on e.id = r.event_id
   where r.id = p_result_id;

  if v_result.id is null then
    raise exception 'The selected result does not exist.';
  end if;
  if v_result.status <> 'official' or v_result.position not in (1,2,3) then
    raise exception 'Only official first-, second- and third-place results qualify for certificates.';
  end if;
  if not v_result.is_active then
    raise exception 'The event is inactive.';
  end if;

  select s.id, s.category::text as category, s.house_id, s.is_active
    into v_student
    from public.students s
   where s.id = p_student_id;
  if v_student.id is null or not v_student.is_active then
    raise exception 'The selected participant is not active.';
  end if;
  if v_student.category <> v_result.category then
    raise exception 'Participant category does not match the result category.';
  end if;

  if v_result.student_id is not null then
    if v_result.student_id <> p_student_id then
      raise exception 'Participant does not belong to the individual result.';
    end if;
  elsif v_result.team_id is not null then
    if not exists (
      select 1 from public.event_team_members etm
       where etm.team_id = v_result.team_id and etm.student_id = p_student_id
    ) then
      raise exception 'Participant is not a member of the team result.';
    end if;
  else
    raise exception 'The result has no participant or team.';
  end if;

  insert into public.athlon_certificates (certificate_no, result_id, student_id, generated_by, generated_at, revoked_at, revoked_by)
  values (
    'SAR26-CERT-' || lpad(nextval('public.sargamiya_certificate_number_seq')::text, 5, '0'),
    p_result_id, p_student_id, auth.uid(), now(), null, null
  )
  on conflict (result_id, student_id) do update
    set generated_by = excluded.generated_by,
        generated_at = now(),
        revoked_at = null,
        revoked_by = null
  returning certificate_no into v_certificate_no;

  return v_certificate_no;
end;
$$;

revoke all on function public.create_athlon_certificate(uuid, uuid) from public, anon;
grant execute on function public.create_athlon_certificate(uuid, uuid) to authenticated;

create or replace function public.delete_athlon_certificates_by_result(p_result_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to revoke certificates.';
  end if;

  update public.athlon_certificates
     set revoked_at = now(), revoked_by = auth.uid()
   where result_id = p_result_id and revoked_at is null;
  get diagnostics v_count = row_count;
  return jsonb_build_object('deleted_count', v_count);
end;
$$;

revoke all on function public.delete_athlon_certificates_by_result(uuid) from public, anon;
grant execute on function public.delete_athlon_certificates_by_result(uuid) to authenticated;

-- These views expose only the fields needed for certificate validation and download.
create or replace view public.athlon_certificate_verification as
select
  c.certificate_no, c.generated_at, c.revoked_at,
  case when c.revoked_at is null and r.status = 'official' then 'official' else r.status::text end as status,
  s.name as participant_name, e.name as event_name, e.category::text as category,
  e.discipline, et.team_name, h.name as house, r.position, r.result_value, r.result_unit, s.chest_no
from public.athlon_certificates c
join public.results r on r.id = c.result_id
join public.events e on e.id = r.event_id
join public.students s on s.id = c.student_id
left join public.event_teams et on et.id = r.team_id
left join public.houses h on h.id = s.house_id
where e.is_active = true;

create or replace view public.athlon_public_certificate_lookup as
select certificate_no, generated_at, revoked_at, participant_name, event_name, category,
       discipline, team_name, house, position, result_value, result_unit, chest_no,
       case position when 1 then 'CHAMPION' when 2 then 'RUNNER-UP' when 3 then 'THIRD PLACE' else 'ACHIEVEMENT' end as achievement
from public.athlon_certificate_verification;

revoke all on public.athlon_certificate_verification from public;
revoke all on public.athlon_public_certificate_lookup from public;
grant select on public.athlon_certificate_verification to anon, authenticated;
grant select on public.athlon_public_certificate_lookup to anon, authenticated;
