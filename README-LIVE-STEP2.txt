SARGAMIYA LIVE — STEP 2: UPCOMING EVENTS

This update expands the Live carousel to five destinations:
1. Current Standings
2. Upcoming Events
3. Latest Results
4. Highlights
5. Announcements

The Upcoming Events slide reads the next three future, timed entries from the existing public schedule view `athlon_public_schedule`. Event names, sections, times and venues are rendered as page text from Supabase; they are not baked into the artwork.

The Latest Results slide reads official results from `athlon_public_results`, sorted by latest update. Results are refreshed through the existing Supabase connection and a results-table realtime subscription where configured.

All five Live slides use separate canonical mascot scenes for standings, upcoming events, results, highlights and announcements. NOVA follows the supplied Master Character Sheet: spherical head, smooth rounded matte-white body, expressive dark eyes with blue highlights, the blue ESRA chest emblem, and a floating four-point star. Headset pieces and unnecessary mechanical seams are excluded. LUMI retains her established orange artist design. The homepage hero now uses the same canonical identity. The standings responsive layout fix and improved admin schedule workflow are retained.

PATCH INSTALLATION
1. Stop the development server (Ctrl+C).
2. Extract this patch into your existing project folder (the folder containing package.json), preserving the included relative paths and allowing files to merge/replace.
3. Keep your .env.local file unchanged.
4. Restart with `npm run dev` and open http://localhost:3000/live.

Patch files:
- app/live/page.tsx
- app/page.tsx
- public/images/sargamiya-standings-canonical.webp
- public/images/sargamiya-upcoming-canonical.webp
- public/images/sargamiya-results-canonical.webp
- public/images/sargamiya-highlights-canonical.webp
- public/images/sargamiya-announcements-canonical.webp
- public/images/sargamiya-home-hero-canonical.webp

No new database migration is required if the existing Sargamiya public schedule and public results views have already been applied. The app uses the same Supabase configuration as the existing website.

VERIFICATION
The Live page passed TypeScript/JSX transpilation syntax checks and the global CSS passed PostCSS parsing. A full Next.js production build was not run because project dependencies are not installed in this workspace.
