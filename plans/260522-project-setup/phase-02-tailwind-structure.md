# Phase 2: Tailwind Theme & Project Structure

## Requirements
Replace minimal scaffold styling with SETUP brand tokens and create the full folder skeleton so Phases 3–6 can add files without restructuring.

## Steps
1. Confirm PostCSS uses Tailwind v4 plugin only; do not add a legacy tailwind config file.
2. Replace `app/globals.css` with SETUP brand CSS variables, `@theme` token mapping, and base layer styles for background, foreground, and borders.
3. Add or update Next config for remote image patterns and any app-specific metadata base URL from env.
4. Create directory skeleton under app route groups, components, lib, hooks, types, and utils per SETUP structure (auth, admin, teacher/instructor, student placeholders).
5. Add stub `page.tsx` for auth routes **`/login`**, **`/register`**, **`/reset-password`** and dashboard prefixes **`/admin`**, **`/teacher`**, **`/student`** (minimal placeholder text) so Phase 5/7 middleware smoke tests do not 404.
6. Remove or replace Geist font usage in scaffold in preparation for Phase 6 layout fonts.

## Success Criteria
- `app/globals.css` contains `@import "tailwindcss"`, `:root` brand tokens, and `@theme` block — no v3 `@tailwind` directives.
- All SETUP folder paths exist (empty or with minimal placeholder files acceptable).
- `npm run dev` renders home page with new theme tokens applied (visible primary/background colors).
- `npm run build` succeeds with new folder structure and no missing import errors from placeholders.

## Risks
- Duplicate theme definitions between SETUP and UI doc: use SETUP brand colors as source of truth; UI doc tokens are secondary.
- Creating route groups too early without pages: add minimal `page.tsx` stubs to avoid 404 during smoke tests.
