# Phase 7: Verification & Dev Smoke Test

## Requirements
Prove the setup is merge-ready by running the full validation pipeline and manual smoke checks on port 5173 without requiring a live backend.

## Steps
1. Run formatter, linter with fix, and TypeScript no-emit check via validate script; fix any errors introduced in Phases 1–6.
2. Run production build and confirm zero compile errors and no unexpected middleware or provider warnings in build output.
3. Start dev server on port 5173 and verify home page loads with correct fonts, theme tokens, and provider-wrapped content.
4. Smoke-test middleware with a **dev mock JWT**: set `authToken` cookie (DevTools or documented snippet) with payload `{ role: ["ROLE_TEACHER"], exp: future }` signed or unsigned per decode-only middleware; verify redirect from `/login` to `/teacher/dashboard` and blocked `/admin` without admin role.
5. Smoke-test UI: trigger sonner toast and confirm visible themed notification; verify at least one form-capable page or isolated form renders without console errors.
6. Smoke-test Redux persist: reload browser and confirm no provider crash (auth state may be empty without backend).
7. Update project README or inline checklist marking SETUP items complete through Phase 6; note Phase 8 optional scope.

## Success Criteria
- `npm run validate` exits 0 (format, lint, type-check).
- `npm run build` exits 0.
- `npm run dev` serves on `http://localhost:5173` with home page HTTP 200.
- Manual middleware redirect behavior observed for at least one protected route prefix.
- No uncaught errors in browser console on home page load.

## Risks
- Validate script runs format write on entire repo including unrelated files: scope prettier ignore or run checks only on touched paths if noise is excessive.
- ESLint rules conflict with copied Beyond8 patterns: fix incrementally without disabling rules globally.
