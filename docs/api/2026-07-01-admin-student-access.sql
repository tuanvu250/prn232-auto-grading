-- Superseded 2026-07-04 by docs/api/2026-07-04-normalize-erd-schema.sql:
-- `allowed_emails` is the pre-normalization legacy table, replaced by
-- `students`/`class_students`. Kept alive only until production has run
-- stably on the new schema (Phase 7). Do not apply this file to a fresh project.

create table if not exists allowed_emails (
  email text primary key,
  student_id text not null,
  class_name text not null
);

create index if not exists allowed_emails_class_student_idx
on allowed_emails (class_name, student_id);

create or replace function check_email_whitelist(email_to_check text)
returns table(student_id text, class_name text)
language sql
security definer
set search_path = public
as $$
  select allowed_emails.student_id, allowed_emails.class_name
  from allowed_emails
  where lower(allowed_emails.email) = lower(email_to_check)
  limit 1;
$$;
