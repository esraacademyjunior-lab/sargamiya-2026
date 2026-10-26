# Sargamiya 2026 — ESRA Global Science Academy

A Next.js and Supabase platform adapted from the Athlon 2026 management system for the **Sargamiya Annual Arts Fest 2026**. The public Live page includes a colourful, animated NOVA-and-LUMI slideshow alongside the live schedule, house standings and festival notices.

## Included modules

- Public landing page and event catalogue
- Student register, import/export tools and participant lookup
- Event management across Senior Boys, Senior Girls, Junior Boys and Junior Girls
- Individual registrations and group-event roster management
- Programme / schedule publishing with public schedule pages
- Result entry, official results portal and downloadable results
- Event-wise participant list import, five-indicator judgement sheets for three judges, and consolidated score sheets
- Automatic house-point scoring, manual special house points and live house standings
- Analytics and student / house performance summaries
- Certificate pages, QR verification routes and bulk PDF/ZIP generation
- Admin routes and Supabase authentication integration

The three houses and their supplied logos are retained: **Atlas (Blue), Titan (White), and Olympus (Red)**.

## Requirements

- Node.js 20 or newer
- npm
- A new, dedicated Supabase project for Sargamiya 2026

## Local setup

1. Copy `.env.example` to `.env.local` and set the Supabase URL and publishable key from the new Sargamiya project. Do **not** copy credentials from another project.
2. Install dependencies: `npm install` (or `npm ci` when using the lockfile).
3. Set up Supabase using the ordered instructions in `supabase/README.md`.
4. In Supabase Authentication, create an administrator user and keep public sign-ups disabled. Review the supplied RLS policies and tighten them to your administrator role model before production.
5. Run the development server: `npm run dev`.
6. Open `http://localhost:3000`, then sign in at `/login` to manage registrations, schedules, results and certificates.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Set `NEXT_PUBLIC_SITE_URL` to the deployed origin for certificate QR verification. Never expose a Supabase service-role key in a browser variable.

## Event catalogue

`data/events.json` contains 30 event types in each boys category and 29 in each girls category. `supabase/schema.sql` seeds 118 category-specific event records. Burda Recitation is group format; Duff is limited to boys categories. Group competitions are configured as team-format events so the existing group roster and group scoring modules can be reused. Event formats and scoring should be reviewed before launch.

## Temporary branding assets

- `public/brand/sargamiya-logo-placeholder.png` — temporary wordmark badge used in public portals
- `public/certificates/sargamiya-logo-placeholder.png` — temporary certificate wordmark
- Canonical mascot crops are maintained under `public/images/canonical/`; reference model sheets are retained under `public/brand/canonical/`
- `public/brand/houses/` — retained Atlas, Titan and Olympus house logos

Replace both temporary Sargamiya logo assets with the official logo when received. The approved hero artwork is applied in `app/page.tsx`; the admin page hero is separate and can be reviewed independently.

## Certificate migration

The certificate SQL migration is included at `supabase/certificates.sql`. Run it after the base schema, result tables, RLS policies and team-management migration. Review and tighten the inherited authenticated access policies before production, as explained in `supabase/README.md`.

## Build

```bash
npm run build
```

Internal database/view/function identifiers retain the `athlon_` prefix to minimize risk when adapting existing code. They are implementation names only. Use a separate Supabase project for this event.


## Animated Sargamiya Live page

The public page at `/live` now includes a three-slide auto-advancing carousel, slide indicators, previous/next controls, pause/play, animated NOVA and LUMI hero artwork, responsive layouts, live programme status, next-event details, house standings and festival notices. The carousel can be paused and respects the visitor's reduced-motion preference. The existing schedule, manual-override and house-points Supabase data flow is retained. No new SQL migration is required for this visual update.

The Live carousel and homepage now use the same two canonical model-sheet assets in separate mascot components rather than composite scene art. This keeps NOVA’s rounded white form, blue ESRA chest emblem and floating star, and LUMI’s orange beret/hair/hoodie, star clip, brown skirt, brush and palette tied directly to the supplied model sheets. The retired composite mascot scenes have been removed to prevent them being reused accidentally.

## Judging and score consolidation

Apply `supabase/event-judging.sql` once in Supabase after the base schema and team-management migration. In **Admin → Judging & Scores**, select an event to import participants by Chest No, download a judgement workbook for a specific judge, import the completed sheet with all five scoring indicators filled, and download a consolidated workbook after all three judges have scored. Group-format events use active event teams as score entries. Entries missing one or more judges' marks remain Pending and are not ranked.
