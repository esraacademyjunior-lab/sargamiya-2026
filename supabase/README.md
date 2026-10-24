# Sargamiya 2026 — Supabase setup

Create a **dedicated Supabase project** for Sargamiya 2026, then run these SQL files in order from the Supabase SQL Editor:

1. `schema.sql` — base tables, house records, four student categories and all event seeds.
2. `results-and-points.sql` — result validation, automatic scoring and the auditable house-points ledger.
3. `live-dashboard.sql` — aggregate live house standings and dashboard summary.
4. `public-results.sql` — public-safe official results and event catalogue.
5. `public-schedule.sql` — public schedule and authenticated schedule management.
6. `analytics.sql` — house, event and student performance analytics.
7. `registration-rls.sql`, `students-rls-for-auth.sql`, `admin-rls.sql` — authenticated access policies.
8. `team-management.sql` — group-event rosters and registration validation.
9. `certificates.sql` — certificate issuance, revocation and public-safe verification views.
10. `event-catalogue-corrections.sql` — corrects Burda Recitation format and deactivates Duff under girls categories for existing projects.
11. `event-judging.sql` — adds secure judgement-score storage for three judges and five scoring indicators per participant/team.

The seed creates **30 events in each boys category and 29 in each girls category**, for **118 category-specific event records**. Burda Recitation is a group event, and Duff is available only to boys categories. Individual events use 5–3–1 scoring; group events use 10–6–4. The event format and point values can be reviewed and adjusted before launch.

The application retains stable internal database/view/function identifiers with an `athlon_` prefix because it was adapted from the Athlon platform. These are implementation names only; the event data and branding are for Sargamiya 2026. **Use a new, separate Supabase project** so no Athlon records are mixed into Sargamiya.

## Before production

- Configure the site’s public URL and Supabase URL/publishable key in `.env.local` (copy `.env.example`).
- Review the authenticated admin policies before inviting users. The included policies are inherited from the source app and should be tightened to your actual admin-role model if non-admin users will sign in.
- The certificate migration provides public views that expose only fields needed for verification. Review your school’s consent and disclosure requirements before publishing student results or certificate verification pages.
- Verify the four categories and all event formats after running the seed. Group vocal and performing events are seeded with `team` format so the existing group-roster workflow can be used.

## Existing Supabase projects

If the `students` table has already been created, run `remove-admission-number-requirement.sql` once in the Supabase SQL Editor. This makes `admission_no` nullable while preserving existing values and the uniqueness constraint. The Add Student form now identifies SARGAMIYA participants by their unique Chest Number.


## Troubleshooting bulk student imports

If the import preview succeeds but every insert reports `new row violates row-level security policy for table "students"`, run `student-import-rls.sql` in Supabase SQL Editor, then sign out and sign back into the Sargamiya admin website. This migration keeps RLS enabled and allows row management only for authenticated Supabase users; do not solve this by adding insert access for `anon` or disabling RLS. Only create Supabase Auth users for trusted staff.

The downloadable Excel template and import preview no longer require or display Admission Number. Older workbooks that still contain an Admission column can also be imported; that column is ignored and new records store `admission_no` as `NULL`. Existing admission values are preserved when editing existing students.


The same Registration Excel workbook supplied for Sargamiya is downloadable from **Admin → Event Registration → Registration Template**. Its workbook layout is preserved; import processing matches event registrations against the active event catalogue and each student’s category.


## Judging and consolidated score sheets

Run `event-judging.sql` once before using **Admin → Judging & Scores**. The page supports event-wise participant imports using Chest No, downloadable five-indicator judgement workbooks for Judge 1, Judge 2 and Judge 3, importing marks back into Supabase, and a consolidated workbook with each judge's indicator marks, individual judge totals, combined total, average per judge and ranked position. Each of the five indicators accepts a non-negative numeric mark, including decimals; blank indicator cells are rejected. An entry is ranked only when all three judges have submitted marks.

For group-format events, active event teams from **Admin → Group Rosters** are judged as a single entry per team. Create teams before downloading a group judgement sheet. The consolidated sheet is a scoring report only; it does not automatically post official results or award house points. Scores are accessible to authenticated users under the included RLS policy; review and restrict policies further if your project has non-admin authenticated users.

## Sargamiya Live status override

Run `live-status-override.sql` after `schema.sql` and `public-schedule.sql`. This creates the singleton live-control row used by `/live` and `/admin/live`. The public page calculates status from scheduled date/time by default; an authenticated admin can publish a manual event/status/message and restore automatic mode when the disruption is over.
