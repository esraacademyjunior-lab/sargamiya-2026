SARGAMIYA 2026 — Registered Participants on Schedule

WHAT CHANGED
- The Schedule page now reads event totals from athlon_public_event_participant_counts.
- The migration defines athlon_public_event_participants from the registrations table.
- Only registrations whose status is 'registered' are counted; withdrawn or disqualified registrations are excluded.
- The Schedule page already refreshes its data every 30 seconds, so updated registrations appear automatically.
- The event participant detail page continues to read athlon_public_event_participants.

REQUIRED SUPABASE STEP
1. Open the Supabase project used by the Sargamiya website.
2. Open SQL Editor and run: supabase/registered-participants-schedule-fix.sql
3. Refresh /schedule in the browser. Registered counts should appear beside each scheduled event.

NOTES
- Do not replace or delete your .env.local file.
- This migration replaces the two public participant views. In the project source, these views have no dependent views other than the counts view recreated here.
- If the SQL fails because another custom database object depends on athlon_public_event_participants, stop and inspect that dependency before dropping anything.
- The generated package has not been tested against your live Supabase database. Verify counts against a known event after applying the SQL.
