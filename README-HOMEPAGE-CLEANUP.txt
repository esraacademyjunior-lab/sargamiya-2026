SARGAMIYA 2026 — HOMEPAGE CLEANUP

Updated file:
- app/page.tsx

What changed:
- Kept the supplied Sargamiya hero artwork, but display it at its original wide aspect ratio so the event branding and artwork are no longer unexpectedly cropped.
- Removed the oversized action-card overlay from the artwork area; those same destinations remain available in the restored homepage quick-access section below the poster.
- Restored the hidden quick-access cards and live statistics section, making the homepage useful beyond the poster.
- Simplified the sticky header spacing and active navigation styling, and removed the duplicate ESRA header mark because the full hero artwork already includes ESRA branding.
- Added responsive grid breakpoints for tablets and phones.

No Supabase queries, route paths, event data workflows, or admin logic were changed.

Validation:
- TypeScript TSX transpilation syntax check passed.
- A full Next.js build was not completed in this environment because npm dependency installation did not finish; run `npm ci` followed by `npm run build` on the development machine.
