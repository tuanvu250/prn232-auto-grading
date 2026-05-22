# PRN232 Auto Grading

Next.js 16 frontend foundation for auto-grading: Redux auth, React Query, Tailwind v4, shadcn-style UI.

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (port 5173) |
| `npm run build` | Production build |
| `npm run validate` | format:check + lint + type-check |
| `npm run test` | Vitest unit tests |

## Structure

- `lib/api/` — Axios client with 401 refresh queue
- `lib/redux/` — Auth slice + redux-persist
- `lib/providers/` — Redux, React Query, ThemeProvider, Toaster
- `components/ui/` — Priority shadcn components (19 files)
- `middleware.ts` — RBAC for `/admin`, `/teacher`, `/student`
- `docs/SETUP.md` — Full stack setup reference
- `docs/api-contract.md` — Assumed backend auth contract

## Roles

- `ROLE_ADMIN` → `/admin/dashboard`
- `ROLE_TEACHER` (canonical; `ROLE_INSTRUCTOR` normalized)
- `ROLE_STUDENT` → `/student/dashboard`

## Optional (Phase 8)

SignalR real-time and remaining UI widgets — see `plans/260522-project-setup/phase-08-signalr-extended-ui.md`.
