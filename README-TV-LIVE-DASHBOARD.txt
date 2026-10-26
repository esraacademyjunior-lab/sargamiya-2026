SARGAMIYA LIVE — STAGE-SIDE TV DASHBOARD
=======================================

This update optimizes /live for a large 16:9 screen placed near the stage.
On desktop / TV browser viewports at least 1280px wide and 700px high, it
automatically switches to a no-scroll, full-viewport layout. Smaller screens
retain the responsive page layout.

CONCURRENT EVENTS
-----------------
The schedule status logic now collects EVERY event whose scheduled date and
start/end time span the current moment. It no longer selects only the first
matching event. The stage board renders up to four simultaneous events, each
with its event name, section, venue, and time slot. This makes parallel events
in different venues visible at the same time.

The existing administrator override applies to its selected event only:
- If manually marked Live, that event is added to the current events board.
- If marked Delayed or Paused, that event is excluded from the live list and
  its status/message is shown while other scheduled live events remain visible.
- Other concurrent schedule slots continue to be determined by their times.

TV DISPLAY SETUP
----------------
1. Start the website normally (npm run dev during local testing).
2. Open http://localhost:3000/live on the TV-connected computer.
3. Press F11 for browser fullscreen, or use the browser's kiosk/fullscreen mode.
4. Make sure the screen resolution is set to 16:9 (for example 1920 x 1080 or
   1280 x 720). Large type and the concurrent-event board are sized for distance.
5. Leave the page open. Schedule/status/points/results refresh through the
   existing Supabase subscriptions and periodic clock refresh.

The hero slideshow advances every 12 seconds and still has previous, next, and
pause/play controls. Reduced-motion preferences are respected.

No database migration or environment-variable change is required for this UI
and scheduling-logic update. Preserve .env.local.

VALIDATION
----------
The modified TSX passed TypeScript transpilation, the stylesheet passed a
PostCSS syntax parse, and the output ZIP archives passed integrity checks.
A full Next.js production build and a live Supabase browser test were not run
in this environment, so verify these before deployment.
