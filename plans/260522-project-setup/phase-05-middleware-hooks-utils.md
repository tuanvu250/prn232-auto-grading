# Phase 5: Middleware, Hooks, Utils

## Requirements
Enforce role-based route access at the edge, expose auth and formatting utilities for pages, and centralize cookie security settings.

## Steps
1. Add cookie configuration module with production-aware secure, sameSite, domain, and remember-me max-age helpers.
2. Add `lib/utils/cn.ts` and `lib/utils/index.ts` barrel exporting `cn` as `@/lib/utils` (required before UI copy).
3. Optionally add format helpers under `lib/utils/` only if needed for Phase 6–7; otherwise defer to Phase 8.
4. Implement auth hook wrapping login/logout dispatch, role flags, toast feedback, and role-based redirect targets using configurable route map for admin, teacher, and student dashboards.
5. Adapt RBAC middleware from Beyond8 with an explicit **remove list** — do not port: `/courses`, `/mybeyond`, `/supscription`, tab-query gating, `getPrimaryRole` instructor-only branches, or multi-role mybeyond logic.
6. Implement grading route map in `lib/types/roles.ts`: public routes (`/`, `/login`, `/register`, `/reset-password`), protected prefixes (`/admin`, `/teacher`, `/student`), dashboards (`/admin/dashboard`, `/teacher/dashboard`, `/student/dashboard`); normalize `ROLE_INSTRUCTOR` → `ROLE_TEACHER` in `getUserRoles`.
7. Export middleware matcher covering app routes while excluding static assets and Next internals.

## Success Criteria
- `middleware.ts` compiles and exports config matcher; unauthenticated access to protected prefix redirects to login.
- Authenticated user with mock or test token cookie redirects from auth pages to role-appropriate dashboard prefix.
- `useAuth` hook and format utils import cleanly; `npm run type-check` passes.
- Route role constants live in one file (roles + route map) for easy auto-grading customization.

## Risks
- Middleware cannot access Redux: rely solely on cookie JWT decode; ensure cookie name matches auth slice (`authToken`).
- Teacher vs instructor role naming: support both constant aliases or pick one and document backend JWT claim expectation.
