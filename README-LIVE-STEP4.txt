SARGAMIYA LIVE — STEP 4: FESTIVAL HIGHLIGHTS

This update replaces the old theme chips with a distinct Highlights board in the five-slide Live carousel.
- House Spirit tile reflects the current leader from the existing public house-tally data.
- Latest Achievement tile uses the most recently updated officially published result.
- Next Spotlight tile reflects the next scheduled event and its section/time/venue.
- Each tile links to the relevant public standings, results, or schedule page.
- The Highlights slide uses the existing canonical NOVA/LUMI photography-style artwork and a dedicated amber, lilac and sky-blue theme.
- Responsive layout rules are included for desktop, tablet and mobile, and motion effects respect the existing reduced-motion rule.

PATCH INSTALL
1. Stop the dev server (Ctrl+C).
2. Extract the patch ZIP into the project root (the directory containing package.json), preserving the included sargamiya-2026-website/ paths.
3. Allow app/live/page.tsx and app/globals.css to replace existing files. The highlight artwork is included for completeness.
4. Keep .env.local unchanged.
5. Restart with npm run dev and open http://localhost:3000/live.

No new SQL migration is required; the highlight cards use the existing public data already loaded by the Live page.
