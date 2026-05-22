# Phase 1: Dependencies & Environment

## Requirements
Install wave-one npm packages, create environment and tooling config, and extend package scripts so later phases can build and validate without rework.

## Steps
1. Install state-management and data-fetching packages (Redux Toolkit, redux-persist, TanStack React Query, axios, devtools).
2. Install UI foundation packages (class-variance-authority, clsx, tailwind-merge, lucide-react, next-themes, sonner, required Radix primitives for priority components).
3. Install auth and utility packages (cookies-next, jwt-decode, dayjs, date-fns, js-cookie and types; defer bcryptjs, crypto-js, TipTap, Vidstack, HLS, embla, input-otp until needed).
4. Install form and table packages (react-hook-form, resolvers, zod; defer formik/yup unless explicitly required).
5. Add code-quality dev dependencies and config files (Prettier, eslint alignment per SETUP doc).
6. Create `.env.local` and committed `.env.example` with API URL, app name, app URL on port 5173, and `NEXT_PUBLIC_ENV` — **do not** add `NEXT_PUBLIC_CRYPTO_SECRET_KEY` until a phase needs crypto (deferred with bcryptjs/crypto-js).
7. Update package scripts for dev/build/start on port 5173 plus lint, format, type-check, and validate commands; use `prettier --check` in validate (not `--write` on whole repo) and scope `.prettierignore` to exclude `plans/`, `.cursor/`, `docs/`.

## Success Criteria
- `npm install` completes without errors and `package.json` lists all wave-one dependencies.
- `.env.local` and `.env.example` exist with four public env vars (no crypto secret in wave one).
- `npm run dev` starts without missing-module errors (app may still be minimal scaffold).
- `.prettierrc` and `.prettierignore` exist; `npm run lint` exits successfully on current scaffold.

## Risks
- Installing all SETUP deps at once bloats bundle and slows install: mitigate by strictly deferring wave-two packages listed in plan overview.
- Missing `@types/js-cookie` causes type errors in later phases: install types in this phase alongside js-cookie.
