SARGAMIYA 2026 — ADMIN RESULTS MANUAL DECLARATION OPTION

What changed
- Added a “Mark as Declared Result” action to events in Pending Results and To Be Conducted.
- Manual declarations are stored in public.events.results_declared, so the status persists after refresh.
- Manually declared events appear in Declared Results even when the event does not use the standard 1st/2nd/3rd podium workflow.
- A manually declared event shows “Undo Declaration” so an administrator can reverse it. If positions 1, 2 and 3 are already present, the event remains automatically declared after undoing the manual override.
- The existing automatic rule (top-three positions entered = declared) is preserved.
- Includes the CheckCircle2 and CalendarDays imports required by the earlier build fix.

Files changed in the complete project
- app/admin/results/page.tsx
- supabase/schema.sql (for fresh database setup)
- supabase/result-declaration.sql (migration for an existing database)

Deployment
1. In Supabase SQL Editor, run supabase/result-declaration.sql before using the manual declaration button. This adds the field and update permission for authenticated admins.
2. Extract the patch ZIP into the project root, or use the complete project ZIP. Keep .env.local unchanged.
3. Run npm run build, then start the app.

Security note
The migration grants the declaration workflow to authenticated users under the project's existing convention that signed-in users are trusted school administrators. If this project has distinct staff/admin roles, narrow the policy to the admin role before use.

Validation performed: TypeScript/TSX transpilation, targeted source assertions, SQL review, and ZIP integrity checks. A full Next.js production build/browser test has not been run here.
