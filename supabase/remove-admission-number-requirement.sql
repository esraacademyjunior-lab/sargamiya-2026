-- SARGAMIYA 2026: Admission Number is optional for student registration.
-- Existing values are preserved; new registrations may store NULL.
-- Run this once in the Supabase SQL Editor for an existing project.

alter table public.students
  alter column admission_no drop not null;
