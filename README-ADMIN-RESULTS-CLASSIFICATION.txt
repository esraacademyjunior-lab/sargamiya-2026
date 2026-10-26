SARGAMIYA 2026 — ADMIN RESULTS GROUPING UPDATE

Changed file:
  app/admin/results/page.tsx

The Results selector is now divided into:
1. Declared Results — every registered individual participant / configured team has a result row.
2. Pending Results — partial result entry, or the event's scheduled end has passed with no results.
3. To Be Conducted — no results yet and the event's scheduled end has not passed, including unscheduled events.

Search, category and format filters apply across all three groups. Selecting a card still opens the existing results-entry workspace. Counts reload when the page data is refreshed and after saving or deleting a result. The page reads the existing events, results, registrations, event_teams and event_schedule tables; no SQL migration is required.

Apply the patch by extracting the ZIP into the project folder and allowing the included file to overwrite the existing Results page. Preserve .env.local.

Validation performed: TypeScript/TSX syntax transpilation and targeted source checks. A complete Next.js production build and browser test have not been run in this environment.
