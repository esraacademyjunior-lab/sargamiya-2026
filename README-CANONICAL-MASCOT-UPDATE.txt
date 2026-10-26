SARGAMIYA 2026 — CANONICAL NOVA & LUMI UI UPDATE

WHAT CHANGED
- The homepage hero no longer uses a baked-in composite mascot image. It uses separately framed NOVA and LUMI art sourced from the supplied canonical reference sheets.
- The Live Dashboard slide hero no longer renders the previous composite scene images. Each slide uses the same canonical mascot assets, so the character designs remain consistent across Current Standings, Upcoming Events, Latest Results, Highlights and Announcements.
- The festival treatment remains navy, violet, electric blue, orange and magenta with animated glow accents.
- The homepage hero's mobile spacing has been corrected so the 220–235px desktop-art spacer does not appear on phones; the mascots move into a responsive row below the hero content.
- The actual source model sheets are retained as optimized WebP files in public/brand/canonical/.

CANONICAL ASSETS
- public/images/canonical/nova-canonical-reference.webp — crop from the supplied NOVA Master Character Sheet, including the floating star and chest emblem.
- public/images/canonical/lumi-canonical-reference.webp — crop from the supplied LUMI character sheet, showing the approved beret, star clip, orange hoodie, brown skirt, paintbrush and palette.
- public/brand/canonical/ — all four supplied reference sheets, optimized as WebP.

FILES UPDATED
- app/page.tsx — homepage mascot components, dark festival hero and mobile overrides.
- app/live/page.tsx — canonical mascot pair used in the Live Dashboard art panel.
- app/globals.css — Live Dashboard mascot pair and responsive styling.

INSTALL
1. Back up your project.
2. Extract this patch into the project root (the folder containing package.json), merging/replacing the named files.
3. Keep your existing .env.local and Supabase credentials. No SQL migration is required for this visual change.
4. Run npm ci, then npm run build, then npm run dev.
5. Check the homepage and each of the five /live slides on desktop and mobile.

TEST STATUS
The updated TSX files pass TypeScript parser syntax checks. Dependency installation timed out in this environment before Next.js was installed, so a production build and live browser/Supabase test could not be completed here.
