SARGAMIYA 2026 — PUBLIC RESULTS PORTAL

Changes
- /results is now a read-only public results portal; /admin/results remains the admin workspace.
- Events are grouped into Results Declared, Results Pending, and Events to Be Conducted using the same classification rule as Admin > Results.
- Declared event cards show official top placements when available.
- The Top Students by Category boards rank students by total points earned in officially declared individual events, with placement counts used as tie-breakers.
- Public results refresh every 15 seconds and respond to Supabase realtime notifications where enabled.

Supabase setup
1. Run supabase/public-results-status-and-student-leaders.sql in the Supabase SQL Editor after the existing schema and supabase/public-results.sql have been applied.
2. The migration creates the public-safe views athlon_public_event_status and athlon_public_declared_results. It does not replace the existing athlon_public_results view used by the live dashboard and certificate pages.

Local verification
- Keep .env.local unchanged.
- Run npm run build.
- Open /results to check the public portal and /admin/results to confirm the admin workspace is still available.
