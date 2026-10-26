SARGAMIYA 2026 — HOMEPAGE REDESIGN
=================================

This update redesigns the public homepage to follow the supplied Festival UI Showcase reference while preserving the existing routes and Supabase-driven data:

- Deep navy, violet, cyan and warm neon stage palette with CSS spotlight/stage effects.
- SARGAMIYA 2026 hero title, festival messaging and four large shortcut cards.
- NOVA and LUMI cutout artwork generated from the supplied canonical reference assets. The canonical model sheets remain under public/brand/canonical/.
- Desktop header with ESRA brand and mobile hamburger menu.
- Mobile bottom navigation for Home, Schedule, Live Dashboard and Photo Highlights.
- Home preview of published live_highlights photos from Supabase plus upcoming events.
- Festival discipline strip in the footer area.
- The existing live-house points, schedule, results and admin routes remain in the project.

INSTALL / RUN
-------------
1. Keep a backup of the current website folder.
2. Extract this ZIP into a new folder (or apply the patch ZIP to the existing project root).
3. Preserve your existing .env.local file and Supabase credentials.
4. Run `npm ci`, then `npm run build`, then `npm run dev`.

The home photo preview reads the existing public.live_highlights table where is_published = true. No database migration is introduced by this homepage redesign. If the highlights table has not been installed yet, the homepage displays a link to the gallery instead of photos.

VALIDATION NOTE
---------------
The edited TSX file passed TypeScript syntax transpilation. A full Next.js production build could not be run in this environment because dependency installation timed out; please run the build locally before deployment.
