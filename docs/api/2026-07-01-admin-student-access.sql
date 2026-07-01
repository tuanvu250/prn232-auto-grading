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
