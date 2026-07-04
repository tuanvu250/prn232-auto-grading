-- Superseded 2026-07-04 by docs/api/2026-07-04-normalize-erd-schema.sql:
-- `resubmission_requests` is the pre-normalization legacy table (string FKs:
-- email/class_name/lab_id), replaced by `resubmission_requests_v2` (FK to
-- `submission_id`). Kept alive only until production has run stably on the
-- new schema (Phase 7). Do not apply this file to a fresh project.

create table if not exists resubmission_requests (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  email text not null,
  name text,
  class_name text,
  lab_id text not null,
  drive_link text not null,
  note text,
  admin_note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by text,
  constraint resubmission_status_check check (status in ('pending', 'approved', 'rejected', 'completed')),
  constraint resubmission_rejected_note_check check (status <> 'rejected' or nullif(btrim(admin_note), '') is not null)
);

alter table resubmission_requests
add column if not exists admin_note text;

alter table resubmission_requests
add column if not exists completed_at timestamptz;

alter table resubmission_requests
add column if not exists completed_by text;

alter table resubmission_requests
drop constraint if exists resubmission_status_check;

alter table resubmission_requests
add constraint resubmission_status_check
check (status in ('pending', 'approved', 'rejected', 'completed'));

alter table resubmission_requests
drop constraint if exists resubmission_rejected_note_check;

alter table resubmission_requests
add constraint resubmission_rejected_note_check
check (status <> 'rejected' or nullif(btrim(admin_note), '') is not null);

create unique index if not exists resubmission_one_pending_per_lab
on resubmission_requests (student_id, lab_id)
where status = 'pending';

create index if not exists resubmission_requests_status_updated_idx
on resubmission_requests (status, updated_at desc);

create index if not exists resubmission_requests_student_idx
on resubmission_requests (student_id, updated_at desc);
