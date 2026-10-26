SARGAMIYA 2026 — LIVE PAGE 4K LAYOUT FIX

What changed
- Prevents the slide text column from overlapping the mascot artwork on desktop.
- Corrects title sizing and column widths on the Results, Highlights and Announcements slides.
- Adds a viewport-height grid for UHD/4K displays (minimum 2500 CSS px wide and 1300 CSS px high).
- Fits the header, carousel, programme status, three information cards, footer and update timestamp within the viewport.
- Uses compact 4K typography and card sizing, including the current results, upcoming events, highlights and event photo gallery.
- Hides document scrolling while the Live page is displayed in the supported UHD breakpoint.

Install full website
1. Extract Sargamiya-Website-Live-4K-No-Scroll-Fixed.zip.
2. Copy/merge the contents of sargamiya-2026-website into your project folder.
3. Keep your existing .env.local file; never replace it with an example file.
4. Run npm run dev and open /live. For production, run npm run build before deployment.

Install patch only
1. Extract Sargamiya-Live-4K-No-Scroll-Layout-Patch.zip.
2. Merge app/globals.css into the same path in your project.
3. Restart the Next.js development server and refresh /live.

Breakpoint note
The fixed no-scroll layout activates at >=2500 CSS px width and >=1300 CSS px height. If Windows display scaling causes a 4K screen to report a smaller CSS viewport, use the browser in full-screen/kiosk mode and adjust display scaling or browser zoom so the CSS viewport meets that breakpoint. At narrower widths, the page retains its normal responsive/scrollable behaviour.

The CSS patch was reviewed against the current project markup. It has not been visually tested against a live browser/4K TV or built against the live Supabase configuration in this environment.
