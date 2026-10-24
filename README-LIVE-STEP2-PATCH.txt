SARGAMIYA LIVE — UPCOMING EVENTS PATCH

Extract the contents of this archive into the root of the existing Sargamiya website project (the directory containing package.json) and allow the included files to replace the current ones.

Included:
- app/live/page.tsx — Five-slide carousel and live schedule/results content.
- app/globals.css — Upcoming-events styling and responsive styles, retaining standings and admin schedule CSS fixes.
- public/images/sargamiya-upcoming-avatar.webp — Upcoming-events mascot scene.
- public/images/sargamiya-announcements-avatar.webp — Announcements mascot scene.

Keep .env.local unchanged. Restart the dev server after copying files. No new SQL migration is needed if the existing public schedule/results views are applied.

Validation: TSX transpilation syntax check passed; CSS parsed successfully. Full production build not verified in this environment.
