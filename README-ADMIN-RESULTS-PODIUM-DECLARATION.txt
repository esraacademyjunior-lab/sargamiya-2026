SARGAMIYA 2026 — ADMIN RESULTS PODIUM DECLARATION UPDATE

Changed file:
  app/admin/results/page.tsx

Declaration rule:
  An event moves to Declared Results as soon as at least one result has been entered for each of positions 1, 2, and 3. It no longer waits for every registered participant or configured team to have a result row.

Grouping behaviour:
  • Declared Results — positions 1, 2, and 3 are all present.
  • Pending Results — some result rows exist, but one or more of positions 1, 2, and 3 are missing; also scheduled events whose end time has passed without any results.
  • To Be Conducted — no results yet and the scheduled end time has not passed, including unscheduled events.

The page refreshes its event progress after a result is saved or deleted and when events are reloaded. The classification now only queries the results and event_schedule tables; no database migration is required. The missing CheckCircle2 and CalendarDays icon imports from the previous build fix are retained.

Apply by extracting the patch ZIP into the project root and allowing app/admin/results/page.tsx to overwrite the existing file. Preserve .env.local.

Validation performed: TypeScript/TSX transpilation and targeted source assertions; ZIP integrity. A full Next.js production build and browser test have not been run in this environment.
