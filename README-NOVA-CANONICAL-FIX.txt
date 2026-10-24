SARGAMIYA 2026 — NOVA CANONICAL DESIGN FIX

This update refreshes the NOVA artwork across the five-slide Live carousel and the public homepage hero using the supplied NOVA Master Character Sheet as the identity standard.

Canonical features reflected in the replacement artwork:
- Large spherical head with friendly rounded proportions.
- Smooth, soft white body with rounded limbs and no unnecessary mechanical seams.
- Large expressive dark eyes with blue highlights, simple curved brows and a friendly smile.
- Blue ESRA-style crescent emblem on the chest.
- Floating four-point NOVA star.
- No headset/ear-disc accessories or extra armour details.
- LUMI retains her established orange beret/hoodie artist identity; each slide gives NOVA and LUMI a different activity-specific pose.

Live slide assets:
- public/images/sargamiya-standings-canonical.webp — trophy and podium celebration.
- public/images/sargamiya-upcoming-canonical.webp — event clipboard / upcoming schedule.
- public/images/sargamiya-results-canonical.webp — medals and results podium.
- public/images/sargamiya-highlights-canonical.webp — exploring and capturing festival memories.
- public/images/sargamiya-announcements-canonical.webp — megaphone and notice card.
- public/images/sargamiya-home-hero-canonical.webp — homepage hero artwork.

INSTALLATION
1. Stop the dev server with Ctrl+C.
2. Extract the patch ZIP into the existing project folder containing package.json, merging/replacing files as prompted.
3. Preserve .env.local.
4. Restart using npm run dev and refresh /live and the homepage with Ctrl+F5.

This is a visual asset and path update only. No database migration is required. The TypeScript source syntax and image paths were checked, but a full production build was not completed in this environment.
