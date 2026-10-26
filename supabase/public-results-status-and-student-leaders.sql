-- SARGAMIYA 2026 — Public Results Status + Published Results
-- Run in the Supabase SQL Editor after schema.sql and the existing public-results.sql.
-- This creates public-safe views; the admin result-entry screens continue to use the base tables.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS results_declared boolean NOT NULL DEFAULT false;

-- One row per active event with the same classification inputs used by Admin > Results.
CREATE OR REPLACE VIEW public.athlon_public_event_status AS
SELECT
  e.id AS event_id,
  e.category,
  e.name AS event_name,
  e.discipline,
  COALESCE(e.scoring_format, e.format)::text AS event_format,
  e.is_active,
  e.results_declared,
  (COUNT(DISTINCT r.position) FILTER (WHERE r.position IN (1, 2, 3)) = 3) AS has_top_three_positions,
  COUNT(r.id)::integer AS result_entries,
  COUNT(r.id) FILTER (WHERE r.status = 'official')::integer AS official_results,
  MAX(r.updated_at) FILTER (WHERE r.status = 'official') AS last_result_at,
  es.scheduled_date,
  es.start_time,
  es.end_time,
  es.venue
FROM public.events e
LEFT JOIN public.results r ON r.event_id = e.id
LEFT JOIN public.event_schedule es ON es.event_id = e.id
WHERE e.is_active = true
GROUP BY
  e.id, e.category, e.name, e.discipline, e.scoring_format, e.format,
  e.is_active, e.results_declared, es.scheduled_date, es.start_time, es.end_time, es.venue;

REVOKE ALL ON public.athlon_public_event_status FROM anon, authenticated;
GRANT SELECT ON public.athlon_public_event_status TO anon, authenticated;

-- Public-facing declared results only: manually declared events or events with all three podium positions.
CREATE OR REPLACE VIEW public.athlon_public_declared_results AS
WITH event_declaration AS (
  SELECT
    e.id AS event_id,
    (e.results_declared OR COUNT(DISTINCT r2.position) FILTER (WHERE r2.position IN (1, 2, 3)) = 3) AS is_declared
  FROM public.events e
  LEFT JOIN public.results r2 ON r2.event_id = e.id
  WHERE e.is_active = true
  GROUP BY e.id, e.results_declared
)
SELECT
  r.id AS result_id,
  r.event_id,
  e.category,
  e.discipline,
  e.name AS event_name,
  COALESCE(e.scoring_format, e.format)::text AS event_format,
  r.position,
  r.result_value,
  r.result_unit,
  r.points_awarded,
  CASE
    WHEN r.student_id IS NOT NULL THEN s.name
    ELSE COALESCE(et.team_name, h.name || ' Team')
  END AS participant_name,
  CASE WHEN r.student_id IS NOT NULL THEN s.chest_no ELSE NULL END AS chest_no,
  h.name AS house,
  r.updated_at
FROM public.results r
JOIN public.events e ON e.id = r.event_id
JOIN event_declaration ed ON ed.event_id = e.id AND ed.is_declared
LEFT JOIN public.students s ON s.id = r.student_id
LEFT JOIN public.event_teams et ON et.id = r.team_id
LEFT JOIN public.houses h ON h.id = CASE
  WHEN s.house_id IS NOT NULL THEN s.house_id
  WHEN et.house_id IS NOT NULL THEN et.house_id
END
WHERE r.status = 'official'
  AND e.is_active = true;

REVOKE ALL ON public.athlon_public_declared_results FROM anon, authenticated;
GRANT SELECT ON public.athlon_public_declared_results TO anon, authenticated;

COMMENT ON VIEW public.athlon_public_event_status IS
  'Public-safe Sargamiya event status, result counts, declaration flag, and schedule metadata.';
COMMENT ON VIEW public.athlon_public_declared_results IS
  'Public-safe official placements for events whose results have been declared.';
