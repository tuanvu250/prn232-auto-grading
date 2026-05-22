# Phase 3: API Layer & Types

## Requirements
Establish typed API contracts and a singleton HTTP client with token injection and 401 refresh-queue behavior matching the backend auth flow.

## Steps
1. Add shared API response and error types at project types root per SETUP (`isSuccess` shape, request params).
2. Add domain model types for user and decoded JWT, ensuring role is modeled as a string array.
3. Add role constants for auto-grading: `ROLE_ADMIN`, `ROLE_TEACHER` (canonical), `ROLE_STUDENT`, plus `ROLE_INSTRUCTOR` as alias documented for JWT normalization only.
4. Implement API service core with axios instance, request interceptor for bearer token, response interceptor with refresh queue and logout on failure.
5. Wire refresh flow to env API URL and auth refresh endpoint path from SETUP; use dynamic imports to avoid circular dependencies with auth slice.
6. Add sample auth fetch service following the `fetchXxx.ts` naming pattern with login, register, and logout methods.

## Exit gate (required before Phase 4)
Document or verify against the grading backend (or `docs/api-contract.md` stub):
- Login/refresh response envelope (`isSuccess` vs `status`).
- Refresh endpoint path and payload field names (`accessToken`, `refreshToken`).
- JWT `role` claim shape (string vs array; `ROLE_TEACHER` vs `ROLE_INSTRUCTOR`).

## Success Criteria
- TypeScript compiles with no errors in `types/` and `lib/api/` after `npm run type-check`.
- Exit gate checklist above is filled in plan notes or a committed contract stub — not left as open assumptions.
- API core exports a default singleton bound to `NEXT_PUBLIC_API_URL`.
- Auth service file exists and returns typed responses matching `ApiResponse` / login response shapes.
- No runtime import cycles between API core and auth slice (verify by successful build).

## Risks
- Backend response shape differs from Beyond8 (`status` vs `isSuccess`): confirm with backend or document assumption; adjust types before wiring Redux.
- Refresh endpoint path mismatch causes silent auth failures: validate path against actual backend or keep clearly commented placeholder.
