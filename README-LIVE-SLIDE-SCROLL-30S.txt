SARGAMIYA 2026 — LIVE DASHBOARD SCROLLING UPDATE
Date: 26 October 2026

Changes:
- The full-screen live dashboard rotates between its two current slides every 30 seconds.
- The schedule slide displays all ongoing, upcoming, and recently finished events, not just the first five or six.
- Ongoing, Up Next, and Recently Finished columns scroll independently within their own fixed panels.
- Each overflowing column automatically scrolls slowly on the TV, pauses briefly at the end, then returns to the top. Manual wheel/trackpad scrolling remains supported.
- The overall 16:9 page remains fixed; only the event lists scroll.
- Supabase data refresh remains every 15 seconds. This is separate from the slide rotation interval.

Apply the patch by overwriting app/live/page.tsx and app/globals.css. Keep .env.local and all Supabase credentials unchanged.
