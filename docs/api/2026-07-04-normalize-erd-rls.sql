-- Phase 4 (plans/260704-normalize-grading-erd/phase-04-rls-policies.md)
--
-- IMPORTANT correction vs. the original plan assumption: this app has no Supabase Auth
-- integration. lib/server/supabase.ts (used by every server action in lib/actions/*.ts) talks
-- to Postgres with the service_role key, which always bypasses RLS regardless of policy
-- content — Postgres RLS never applies to it. There is no auth.uid()/JWT-claim path into
-- Postgres today: the app's real identity check is the authToken cookie, decoded server-side
-- in lib/server/auth.ts (getServerUser/userIsAdmin), and every server action already filters
-- explicitly by the decoded studentId/email before querying (see lib/actions/grades.ts,
-- lib/actions/resubmissions.ts). RLS here is defense-in-depth for the anon-key path only
-- (lib/supabase.ts exists but is currently unused/unimported by any component) — it is not the
-- primary access-control mechanism and rebuilding server-action authorization is out of scope.
--
-- Policy: enable RLS with NO policies for anon/authenticated roles on every new table, i.e.
-- default-deny. If lib/supabase.ts's anon-key client is ever wired into a client component in
-- the future, it will read/write nothing until an explicit policy is added — fail closed, not
-- silently inheriting whatever the old `submissions`/`allowed_emails` tables had.

alter table terms enable row level security;
alter table classes enable row level security;
alter table labs enable row level security;
alter table class_labs enable row level security;
alter table students enable row level security;
alter table class_students enable row level security;
alter table class_lab_submissions enable row level security;
alter table resubmission_requests_v2 enable row level security;

-- No CREATE POLICY statements follow deliberately: zero policies + RLS enabled = default deny
-- for anon/authenticated roles on all 8 tables above. service_role (used by every existing
-- server action) is unaffected either way.

-- ----------------------------------------------------------------------------
-- Manual per-role test checklist (Phase 4 step 4) — run using the anon key via the
-- Supabase REST endpoint (not the SQL editor, which runs as postgres/service_role and would
-- bypass RLS):
--   curl "$SUPABASE_URL/rest/v1/class_lab_submissions?select=*" -H "apikey: $ANON_KEY"
--   -> expect an empty array / 200 with 0 rows (no policy grants anon SELECT), confirming
--      default-deny holds before this schema is wired into any client component.
-- ----------------------------------------------------------------------------

-- Rollback (see phase-04 Rollback section): if a future admin/student dashboard needs
-- anon-key access and gets wrongly blocked, disable RLS on just the affected table, e.g.:
--   alter table class_lab_submissions disable row level security;
-- then design and add explicit policies before re-enabling — do not leave it disabled long-term.
