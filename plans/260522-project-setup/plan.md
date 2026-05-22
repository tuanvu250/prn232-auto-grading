# Plan: PRN232 Auto-Grading Project Setup
Status: 🟢 Complete (Phases 1–7)
Date: 2026-05-22
Mode: Hard

## Overview
Bootstrap `prn232-auto-grading` from the bare Next.js 16 scaffold into a production-ready frontend foundation by porting Beyond8 infrastructure from `docs/SETUP.md` and priority UI from `docs/ui-components-widgets-setup.md`, adapted for auto-grading roles and routes.

## Phases
- [x] Phase 1: Dependencies & environment — install core deps in waves, env, scripts, code quality
- [x] Phase 2: Tailwind theme & project structure — globals theme tokens, folder skeleton, next config
- [x] Phase 3: API layer & types — axios core with refresh queue, shared types, auth service pattern
- [x] Phase 4: Redux auth & providers — persisted auth slice, React Query, provider stack without SignalR
- [x] Phase 5: Middleware, hooks, utils — RBAC middleware, auth hooks, cookie config, format helpers
- [x] Phase 6: UI foundation — lib/utils, priority shadcn components, ThemeProvider, root layout
- [x] Phase 7: Verification & dev smoke test — lint, type-check, build, dev server on port 5173
- [ ] Phase 8: SignalR & extended UI (optional) — real-time layer and remaining components/widgets

## Session Notes
<!-- Updated by cook automatically — do not edit manually -->

**Last active:** 2026-05-22
**Phase in progress:** (none — phases 1–7 done)
**Status:** Build, validate, and 3 Vitest tests pass; code review WARNING (76/100)

### Decisions made this session
- Hybrid setup: full infra Phases 1–5, 19 UI components Phase 6, SignalR deferred Phase 8
- `lib/utils/cn.ts` + barrel `lib/utils/index.ts` (not `lib/utils.ts` file)
- Canonical role `ROLE_TEACHER`; `ROLE_INSTRUCTOR` alias in `normalizeRoles`
- Grading routes only — stripped Beyond8 `/courses`, `/mybeyond`
- API contract stub: `docs/api-contract.md` (`isSuccess` envelope)
- Vitest added for `cn` and `normalizeRoles`
- Session expiry redirect via `useAuthSyncAcrossTabs` → `/login`

### Next immediate action
- Optional Phase 8: SignalR + extended UI
- Or: implement login form + grading features on top of foundation

## Research Summary
**Primary approach:** Phased copy from Beyond8 SETUP doc; adapt LMS routes/roles for auto-grading; merge ThemeProvider into the providers stack; use port 5173 and validate scripts from SETUP checklist.

**Alternative approach:** Phase 1 infra only — defer TipTap, HLS/Vidstack, embla, input-otp, bcryptjs, crypto-js until needed; use shadcn CLI on demand or manual copy of priority UI components.

**Chosen hybrid:**
1. Install dependencies in waves — framework, UI, auth first; defer media/editor/crypto packages until a feature needs them.
2. Full SETUP infra through Phase 5 — API core, Redux, React Query, providers, cookieConfig, utils, hooks — **SignalR deferred to Phase 8**.
3. RBAC middleware adapted for grading: canonical `ROLE_TEACHER`, alias `ROLE_INSTRUCTOR`, routes `/admin`, `/teacher`, `/student` — Beyond8 LMS paths explicitly stripped.
4. UI in dedicated Phase 6 — `lib/utils/` barrel + manual copy of 16 primitives + dialog/form/sonner; full 53 components as Phase 8 stretch.
5. Root layout — Open Sans + Quicksand, ThemeProvider + Toaster, full Providers stack (minus SignalR until Phase 8).

## Known auth limits (Beyond8 port)

- Middleware uses `jwtDecode` only — no signature verification at the edge; sensitive actions must rely on API authorization.
- `authToken` cookie is `httpOnly: false` and refresh token is redux-persisted — acceptable for foundation setup; harden with httpOnly + BFF later if required.
- Failed refresh must clear persist + cookie + redirect to `/login` (Phase 4).

## Path conventions (single source of truth)

| Module | Path | Import alias |
|--------|------|--------------|
| Class-name helper | `lib/utils/cn.ts` | `import { cn } from "@/lib/utils"` via barrel |
| Utils barrel | `lib/utils/index.ts` | re-exports `cn` + format helpers |
| Format helpers | `lib/utils/formatCurrency.ts`, `formatDate.ts`, `formatImageUrl.ts`, `generateSlug.ts` | `@/lib/utils` |
| Cookie config | `utils/cookieConfig.ts` | `@/utils/cookieConfig` |
| Roles + route map | `lib/types/roles.ts` | `@/lib/types/roles` |

Do **not** create a file `lib/utils.ts` alongside a `lib/utils/` directory — that breaks on Linux/macOS.

## Canonical grading roles

- **`ROLE_TEACHER`** is the canonical JWT/middleware role for educators.
- **`ROLE_INSTRUCTOR`** is an alias only: normalize to `ROLE_TEACHER` in `jwtDecode` / middleware if the backend sends the legacy claim.

## Dependencies
- Backend API at `NEXT_PUBLIC_API_URL` (default `http://localhost:8080/`) for auth refresh and future services — not required for Phase 7 smoke test if pages use mock JWT.
- Node/npm environment compatible with Next 16.2.6 and React 19.
- Reference docs: `docs/SETUP.md`, `docs/ui-components-widgets-setup.md`.

## Risks
- HIGH: `lib/utils.ts` file vs `lib/utils/` directory — use barrel layout above; UI doc imports stay `@/lib/utils`.
- HIGH: Beyond8 middleware routes (`/courses`, `/mybeyond`, `/instructor`) do not match auto-grading — misconfigured redirects if route map is copied verbatim; use configurable route constants in Phase 5.
- MEDIUM: Cookie name mismatch in SETUP samples (`auth-token` vs `authToken`) — align on `authToken` everywhere before middleware testing.
- MEDIUM: Deferred Radix packages may cause missing-peer errors when copying UI components — install Radix primitives alongside each UI batch.
- LOW: Port 5173 conflicts with other local dev servers — document override in README if needed.
