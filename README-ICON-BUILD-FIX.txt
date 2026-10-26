SARGAMIYA 2026 — Homepage build fix

Fix:
- Removed the unsupported `Dribbble` import from lucide-react.
- Replaced the SPORT category icon with the already-supported `Trophy` icon.

Why:
Lucide React does not export Dribbble (a brand icon), so Next.js/Turbopack fails during module resolution.

Apply:
- For the full website package, use this source and preserve your local `.env.local`.
- For the patch, merge `app/page.tsx` into the existing project, overwriting that file.

Then run:
  npm ci
  npm run build

This patch addresses the specific Dribbble export error. Other build errors, if any, should be handled separately based on their diagnostics.
