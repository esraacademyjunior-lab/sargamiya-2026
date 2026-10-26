SARGAMIYA 2026 — TV SLIDE 02: MULTI-EVENT SCHEDULE

This update redesigns the schedule slide for a festival where multiple competitions run in parallel.

Display
- Three full-height panels: ONGOING NOW, UP NEXT, and RECENTLY FINISHED.
- Each panel shows up to five individual event entries at once, with a total event count.
- When more than five events fall into a status group, a clear “+ N MORE ... IN SCHEDULE” indicator is displayed.
- Every event row shows its name, discipline/category/format, time range or finish time, venue, and date when available.
- There is no separate single-event timeline, avoiding duplication and giving parallel event lists more screen space.
- Fullscreen 16:9 layout; automatic rotation between house points and schedule slides remains 15 seconds.

Data
- Reads the published schedule from public.athlon_public_schedule.
- Ongoing is calculated from scheduled_date + start_time + end_time in Asia/Kolkata time.
- Up Next shows the six nearest future events, ordered by start time.
- Recently Finished shows the six most recently completed events, ordered by end time.
- Schedule data refreshes every 15 seconds and listens for Supabase changes.
- Festival date: 24–28 October 2026.

Apply patch
1. Back up the existing project.
2. Extract this patch in the project root and overwrite app/live/page.tsx and app/globals.css.
3. Preserve your existing .env.local and Supabase settings.
4. Restart `npm run dev` and open http://localhost:3000/live.

Validation
- TypeScript TSX transpile/syntax check passed (no diagnostics).
- Full production build was not run because dependencies are not installed in the working folder.
