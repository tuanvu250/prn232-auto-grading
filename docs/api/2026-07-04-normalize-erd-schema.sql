-- Phase 1 (plans/260704-normalize-grading-erd/phase-01-schema-ddl-rpc.md)
-- Creates the normalized schema alongside the existing tables (allowed_emails/submissions/
-- resubmission_requests). Does not touch or drop any existing data — Phase 2 handles migration.
--
-- Naming note: a legacy `students` table (email PK) is described in
-- docs/api/supabase-integration-guide.md but is not referenced anywhere in the app code
-- (lib/actions/*.ts only use `allowed_emails`). If that legacy table exists in your Supabase
-- project, rename or drop it manually before running this file, since its columns are
-- incompatible with the STUDENTS table created below.
--
-- The new flat submissions table is named `class_lab_submissions` (not `submissions`) to avoid
-- colliding with the existing `submissions` table, which stays untouched until Phase 7 cleanup
-- renames/archives it after migration is verified stable.

-- ============================================================================
-- 1. TERMS / CLASSES / LABS catalog
-- ============================================================================

create table if not exists terms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms (id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  unique (term_id, name)
);

-- Lab catalog is shared across terms — a lab is not locked to one term.
create table if not exists labs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 2. CLASS_LABS — assignment: which lab applies to which class, with its own deadline
-- ============================================================================

create table if not exists class_labs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  lab_id uuid not null references labs (id) on delete restrict,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  unique (class_id, lab_id)
);

create index if not exists class_labs_class_idx on class_labs (class_id);

-- ============================================================================
-- 3. STUDENTS / CLASS_STUDENTS — real student identities + class membership
-- ============================================================================

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  student_code text not null,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create index if not exists class_students_class_idx on class_students (class_id);
create index if not exists class_students_student_idx on class_students (student_id);

-- ============================================================================
-- 4. CLASS_LAB_SUBMISSIONS — flat table, one row per grading attempt
-- ============================================================================
-- No separate "order"/"item" tables: every grading round is one independent,
-- permanent row. status is computed per-row from that row's own score, never
-- inferred from the latest attempt_no for the same (class_student_id, class_lab_id).

create table if not exists class_lab_submissions (
  id uuid primary key default gen_random_uuid(),
  class_student_id uuid not null references class_students (id) on delete cascade,
  class_lab_id uuid not null references class_labs (id) on delete cascade,
  attempt_no integer not null,
  item_type text not null,
  source_url text,
  score numeric(4, 2),
  status text not null,
  details jsonb,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint class_lab_submissions_item_type_check
    check (item_type in ('original', 'late', 'resubmit')),
  constraint class_lab_submissions_status_check
    check (status in ('grading', 'passed', 'failed')),
  constraint class_lab_submissions_attempt_no_positive check (attempt_no > 0),
  constraint class_lab_submissions_unique_attempt
    unique (class_student_id, class_lab_id, attempt_no)
);

create index if not exists class_lab_submissions_lookup_idx
  on class_lab_submissions (class_student_id, class_lab_id, attempt_no desc);

-- ============================================================================
-- 5. RESUBMISSION_REQUESTS — new FK design (submission_id / created_submission_id)
-- ============================================================================
-- Old rule "already approved once => no new request" is dropped. The 3-attempt cap is
-- enforced atomically by create_resubmission_request() below, counting in-flight requests
-- (pending/approved) plus completed resubmit rows — see step 6/7 of phase-01.

create table if not exists resubmission_requests_v2 (
  id uuid primary key default gen_random_uuid(),
  class_student_id uuid not null references class_students (id) on delete cascade,
  class_lab_id uuid not null references class_labs (id) on delete cascade,
  submission_id uuid not null references class_lab_submissions (id) on delete restrict,
  created_submission_id uuid references class_lab_submissions (id) on delete set null,
  drive_link text not null,
  note text,
  admin_note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by text,
  constraint resubmission_requests_v2_status_check
    check (status in ('pending', 'approved', 'rejected', 'completed')),
  constraint resubmission_requests_v2_rejected_note_check
    check (status <> 'rejected' or nullif(btrim(admin_note), '') is not null)
);

create index if not exists resubmission_requests_v2_lookup_idx
  on resubmission_requests_v2 (class_student_id, class_lab_id, status);
create index if not exists resubmission_requests_v2_status_updated_idx
  on resubmission_requests_v2 (status, updated_at desc);

-- ============================================================================
-- 6/8. RPC — create_class_lab_submission(): advisory-lock attempt_no generator
-- ============================================================================
-- Two independent 32-bit advisory-lock keys (not one hashed string) to reduce collision
-- risk between different (class_student_id, class_lab_id) pairs. Transaction-scoped via
-- pg_advisory_xact_lock — released automatically on commit/rollback, no manual unlock needed.
-- UNIQUE(class_student_id, class_lab_id, attempt_no) is the safety net if the lock is ever
-- bypassed (e.g. a client using a different connection pooling mode that breaks session
-- semantics).
--
-- fulfills_request_id (optional): pass the id of a pending/approved resubmission_requests_v2
-- row when this call is fulfilling that request (item_type should then be 'resubmit'). This is
-- the ONLY place resubmission_requests_v2.created_submission_id is ever written.

create or replace function create_class_lab_submission(
  p_class_student_id uuid,
  p_class_lab_id uuid,
  p_item_type text,
  p_source_url text,
  p_score numeric,
  p_details jsonb default null,
  p_fulfills_request_id uuid default null
)
returns class_lab_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key1 int;
  v_key2 int;
  v_attempt_no int;
  v_status text;
  v_row class_lab_submissions;
begin
  -- Split a 64-bit hash of the pair into two independent 32-bit advisory-lock keys.
  v_key1 := hashtextextended(p_class_student_id::text, 0)::bit(32)::int;
  v_key2 := hashtextextended(p_class_lab_id::text, 0)::bit(32)::int;
  perform pg_advisory_xact_lock(v_key1, v_key2);

  select coalesce(max(attempt_no), 0) + 1
  into v_attempt_no
  from class_lab_submissions
  where class_student_id = p_class_student_id
    and class_lab_id = p_class_lab_id;

  v_status := case when coalesce(p_score, 0) >= 5.0 then 'passed' else 'failed' end;

  insert into class_lab_submissions (
    class_student_id, class_lab_id, attempt_no, item_type,
    source_url, score, status, details, graded_at
  )
  values (
    p_class_student_id, p_class_lab_id, v_attempt_no, p_item_type,
    p_source_url, p_score, v_status, p_details, now()
  )
  returning * into v_row;

  if p_fulfills_request_id is not null then
    update resubmission_requests_v2
    set created_submission_id = v_row.id,
        updated_at = now()
    where id = p_fulfills_request_id;
  end if;

  return v_row;
end;
$$;

-- ============================================================================
-- 7. RPC — create_resubmission_request(): atomic count-then-insert, cap = 3
-- ============================================================================
-- Uses the SAME advisory-lock key as create_class_lab_submission() above, so a resubmission
-- request and a concurrent grading run for the same (class_student_id, class_lab_id) never
-- race each other either. Counts requests that are pending/approved AND not yet fulfilled
-- (created_submission_id is null) PLUS completed 'resubmit' submission rows. Excluding
-- already-fulfilled requests from the first count avoids double-counting the same attempt once
-- as "an open request" and again as "a resubmit row" after create_class_lab_submission() sets
-- created_submission_id on it.

create or replace function create_resubmission_request(
  p_class_student_id uuid,
  p_class_lab_id uuid,
  p_submission_id uuid,
  p_drive_link text,
  p_note text default null
)
returns resubmission_requests_v2
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key1 int;
  v_key2 int;
  v_used_count int;
  v_row resubmission_requests_v2;
begin
  v_key1 := hashtextextended(p_class_student_id::text, 0)::bit(32)::int;
  v_key2 := hashtextextended(p_class_lab_id::text, 0)::bit(32)::int;
  perform pg_advisory_xact_lock(v_key1, v_key2);

  select
    (select count(*) from resubmission_requests_v2
      where class_student_id = p_class_student_id
        and class_lab_id = p_class_lab_id
        and status in ('pending', 'approved')
        and created_submission_id is null)
    +
    (select count(*) from class_lab_submissions
      where class_student_id = p_class_student_id
        and class_lab_id = p_class_lab_id
        and item_type = 'resubmit')
  into v_used_count;

  if v_used_count >= 3 then
    raise exception 'resubmission_limit_reached' using errcode = 'P0001';
  end if;

  insert into resubmission_requests_v2 (
    class_student_id, class_lab_id, submission_id, drive_link, note, status
  )
  values (
    p_class_student_id, p_class_lab_id, p_submission_id, p_drive_link, p_note, 'pending'
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================================
-- 9. External call reference (for repo `be`, .NET)
-- ============================================================================
-- Both RPCs are exposed automatically as POST /rest/v1/rpc/<function_name> once created,
-- callable via the Supabase REST/PostgREST endpoint from any language (no need to be
-- Postgres-native), e.g. from C#:
--
--   POST {SUPABASE_URL}/rest/v1/rpc/create_class_lab_submission
--   headers: apikey / Authorization: Bearer <service_role_key>
--   body: {
--     "p_class_student_id": "<uuid>",
--     "p_class_lab_id": "<uuid>",
--     "p_item_type": "original" | "late" | "resubmit",
--     "p_source_url": "<drive link or repo url>",
--     "p_score": 8.5,
--     "p_details": { "...": "..." },
--     "p_fulfills_request_id": "<uuid, omit or null for a fresh original submission>"
--   }
--   -> returns the single new class_lab_submissions row.
--
--   POST {SUPABASE_URL}/rest/v1/rpc/create_resubmission_request
--   body: {
--     "p_class_student_id": "<uuid>",
--     "p_class_lab_id": "<uuid>",
--     "p_submission_id": "<uuid of the class_lab_submissions row that led to the request>",
--     "p_drive_link": "<drive link>",
--     "p_note": "<optional>"
--   }
--   -> returns the new resubmission_requests_v2 row, or errors with 'resubmission_limit_reached'
--      (Postgres errcode P0001) once the 3-attempt cap for that (class_student_id, class_lab_id)
--      is hit — callers should surface this as a user-facing "limit reached" message.
