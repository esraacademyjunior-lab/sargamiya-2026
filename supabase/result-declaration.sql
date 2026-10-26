-- SARGAMIYA 2026 — Manual event result declaration
-- Run this in Supabase SQL Editor before using the manual declaration button.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS results_declared boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.results_declared IS
  'Admin override marking whether result publication has been formally declared.';

-- The application treats authenticated users as trusted school admins.
-- Grant column-level permission for this workflow; existing table grants are not changed.
GRANT UPDATE (results_declared) ON TABLE public.events TO authenticated;

-- Permit signed-in administrators to update the declaration flag on an event.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated update event result declaration" ON public.events;
CREATE POLICY "authenticated update event result declaration"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
