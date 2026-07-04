-- Superseded 2026-07-04 by docs/api/2026-07-04-normalize-erd-schema.sql:
-- `submissions`/`allowed_emails` are the pre-normalization legacy tables, kept
-- alive only until production has run stably on the new schema (Phase 7).
-- Do not apply this file to a fresh project; it targets the legacy schema.

alter table submissions
add column if not exists class_name text;

update submissions s
set class_name = ae.class_name
from allowed_emails ae
where s.student_id = ae.student_id
  and s.class_name is null;

create index if not exists submissions_lab_class_idx
on submissions (lab_id, class_name);
