SARGAMIYA LIVE — 4K TV UPDATE

Changes:
- Adds 4K-targeted responsive sizing for 3840x2160 displays and keeps ordinary laptop/tablet/mobile styles.
- Shows every event whose scheduled date and start/end time includes the current moment, instead of choosing only the first concurrent event.
- Displays each active event's title, section/discipline, venue, and time slot in the Live status area.
- Keeps the five-slide carousel and existing Supabase schema; no migration is required for this layout update.

Apply patch:
1. Stop the Next.js server.
2. Extract the patch ZIP into the project root (the folder containing package.json).
3. Allow app/live/page.tsx and app/globals.css to be replaced.
4. Keep your existing .env.local file.
5. Restart with npm run dev and open /live. Press F11 for browser fullscreen.

TV note:
The 4K-specific layout activates for viewports at least 2500 CSS pixels wide and 1300 CSS pixels high. If Windows display scaling means the browser viewport is smaller, the responsive fallback remains active; use browser fullscreen and verify the reported viewport on the TV.

Validation:
The source was updated and ZIP integrity can be checked, but a TypeScript production build/browser test was not run in this environment because project dependencies are not installed here. Verify event dates, times and venue data against your Supabase project before festival use.
