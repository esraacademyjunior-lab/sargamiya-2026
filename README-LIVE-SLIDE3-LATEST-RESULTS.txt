SARGAMIYA 2026 — LIVE DASHBOARD SLIDE 3: LATEST RESULTS

WHAT'S INCLUDED
- A new third 16:9 TV slide, shown after Live House Points and the multi-event Schedule slide.
- Shows the latest three distinct events with officially published results.
- Each event panel presents up to the top three official placements, participant/team name, house, chest number where available, result value/unit, and points awarded.
- Uses the existing public Supabase view: athlon_public_results. No fabricated results are included.
- Refreshes result data every 15 seconds and reloads when results change through Supabase Realtime.
- The complete slideshow now cycles through three slides every 30 seconds per slide.
- The festival date remains 24–28 October 2026.

INSTALL PATCH
1. Stop the dev server (Ctrl+C).
2. Extract the patch ZIP into the project folder that contains package.json.
3. Allow app/live/page.tsx and app/globals.css to replace the existing files.
4. Keep .env.local unchanged.
5. Restart using npm run dev and open http://localhost:3000/live.

DATA NOTE
The slide only displays events available from athlon_public_results, which filters official results. If there are fewer than three result-bearing events, the remaining cards show waiting states. If the view is missing or access fails, the slide will show an unavailable status rather than invented results.

VALIDATION
The TSX passed TypeScript transpilation/syntax checks, and the CSS passed structural brace checks. A complete Next.js production build and running-browser test were not performed in this environment.
