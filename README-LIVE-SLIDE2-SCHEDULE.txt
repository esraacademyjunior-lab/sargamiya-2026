SARGAMIYA 2026 — TV SLIDE 02: EVENT SCHEDULE

What's included
- The /live screen now alternates between Slide 01 (Live House Points) and Slide 02 (Event Schedule) every 15 seconds.
- Slide 02 displays Ongoing Now, Next Event, Recently Finished, and four upcoming schedule entries.
- Schedule content is read from the existing Supabase view: public.athlon_public_schedule.
- Event status is calculated from scheduled_date, start_time, and end_time using Asia/Kolkata (+05:30) time.
- The screen refreshes published schedule data every 15 seconds and listens for changes to event_schedule/events.
- Festival date is displayed as 24–28 October 2026.

How to apply the patch
1. Back up your current project.
2. Extract this patch into the project root and overwrite app/live/page.tsx and app/globals.css.
3. Keep your existing .env.local file and Supabase credentials unchanged.
4. Restart the dev server (`npm run dev`) and open http://localhost:3000/live.

Validation
- TypeScript TSX transpile/syntax check passed.
- CSS selector presence checks passed.
- A full Next.js typecheck/build was not run in this environment because project dependencies are not installed in the extracted working folder.
