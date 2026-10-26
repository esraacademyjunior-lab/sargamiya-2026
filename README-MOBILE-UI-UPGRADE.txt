SARGAMIYA 2026 — MOBILE UI & NAVIGATION UPGRADE

What's changed
- Improved home-page responsiveness for phones and tablets: sticky compact navigation, horizontally scrollable navigation links, larger touch targets, single-column quick-access cards, more flexible hero actions and tighter small-screen typography.
- Added prominent home-page links to the Live Dashboard (/live) and Photo Highlights (/highlights).
- Added Live Dashboard and Highlights to the main navigation.
- Added a public Photo Highlights gallery at /highlights. It displays published records from the existing Supabase `live_highlights` table and opens a full photograph in a new tab when tapped.
- Added reduced-motion support for visitors who prefer less animation.
- Kept the existing 4K Live display layout and the admin upload route (/admin/highlights).

Install
1. Make a backup of your current project.
2. Extract this ZIP and replace/merge the `sargamiya-2026-website` project folder, or overlay the patch ZIP onto your project root.
3. Keep your existing `.env.local` and Supabase credentials; do not replace them with any example values.
4. Install dependencies with `npm ci` and run `npm run build`, then test on a phone and desktop.

Photo gallery requirements
- Uses the existing `live_highlights` table and `sargamiya-live-highlights` public storage bucket from the Live Photo Highlights feature. If that migration has not yet been applied to your Supabase project, apply the existing `Sargamiya-Live-Photo-Highlights.sql` migration first.
- Admin photo upload remains at `/admin/highlights`; public gallery is `/highlights`; 4K live display remains `/live`.

Validation note
The archive structure was checked, but a production build could not be completed in this environment because dependency installation timed out. Please run `npm ci` and `npm run build` in your development environment before deployment.
