SARGAMIYA 2026 — LIVE DASHBOARD SLIDE 4: FESTIVAL HIGHLIGHTS

WHAT'S INCLUDED
- Adds a dedicated full-screen 16:9 Highlights slide after Live House Points, Schedule, and Latest Results.
- Displays the five newest published photographs from public.live_highlights.
- One large featured image and four smaller image cards make the screen useful for a TV display.
- Titles, event/section labels, and published dates come from the photo records.
- Does not invent photos. If no approved photos are published, the screen shows a designed empty state with the canonical NOVA and LUMI assets.
- Refreshes data every 15 seconds and reloads immediately when live_highlights changes through Supabase Realtime.
- Slide rotation remains 30 seconds per slide; the carousel now cycles through four implemented slides.
- Festival date is 24–28 October 2026.

INSTALL PATCH
1. Stop the dev server (Ctrl+C).
2. Extract the patch ZIP into the project root (the folder containing package.json), allowing app/live/page.tsx and app/globals.css to replace the existing files.
3. Keep .env.local unchanged.
4. Restart with npm run dev and open http://localhost:3000/live.

DATABASE NOTE
The slide reads public.live_highlights, filtered to is_published = true. If the table or public-read policy has not yet been created in Supabase, run supabase/live-photo-highlights.sql in the Supabase SQL Editor. The existing /admin/highlights screen is used to upload and publish approved event photographs.

VALIDATION
The TSX source was syntax/transpilation-checked and the ZIP archive was integrity-checked. A complete Next.js production build and a running-browser test were not performed in this environment.
