-- Conditional rollback for phase 1 only.
-- Refuses rollback once duplicate (class_id, lab_id) sessions exist.
-- The application and grading sync must be paused and rolled back first.

begin;

do $$
begin
  if to_regclass('public.grading_sessions') is null
     or to_regclass('public.session_submissions') is null then
    raise exception 'grading_sessions_rollback_missing_source_tables';
  end if;

  if exists (
    select 1
    from public.grading_sessions
    group by class_id, lab_id
    having count(*) > 1
  ) then
    raise exception 'grading_sessions_rollback_duplicate_class_lab_pairs';
  end if;
end $$;

lock table public.grading_sessions in access exclusive mode;
lock table public.session_submissions in access exclusive mode;

drop function if exists public.create_session_submission(uuid, uuid, text, numeric, jsonb);
drop index if exists public.grading_sessions_one_open_per_class_lab_idx;

alter table public.session_submissions rename column grading_session_id to class_lab_id;
alter table public.session_submissions rename to class_lab_submissions;

do $$
begin
  if to_regclass('public.session_submissions_lookup_idx') is not null then
    alter index public.session_submissions_lookup_idx
      rename to class_lab_submissions_lookup_idx;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.class_lab_submissions'::regclass
      and conname = 'session_submissions_grading_session_id_fkey'
  ) then
    alter table public.class_lab_submissions
      rename constraint session_submissions_grading_session_id_fkey
      to class_lab_submissions_class_lab_id_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.class_lab_submissions'::regclass
      and conname = 'session_submissions_class_student_id_fkey'
  ) then
    alter table public.class_lab_submissions
      rename constraint session_submissions_class_student_id_fkey
      to class_lab_submissions_class_student_id_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.class_lab_submissions'::regclass
      and conname = 'session_submissions_item_type_check'
  ) then
    alter table public.class_lab_submissions
      rename constraint session_submissions_item_type_check
      to class_lab_submissions_item_type_check;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.class_lab_submissions'::regclass
      and conname = 'session_submissions_status_check'
  ) then
    alter table public.class_lab_submissions
      rename constraint session_submissions_status_check
      to class_lab_submissions_status_check;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.class_lab_submissions'::regclass
      and conname = 'session_submissions_attempt_no_positive'
  ) then
    alter table public.class_lab_submissions
      rename constraint session_submissions_attempt_no_positive
      to class_lab_submissions_attempt_no_positive;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.class_lab_submissions'::regclass
      and conname = 'session_submissions_unique_attempt'
  ) then
    alter table public.class_lab_submissions
      rename constraint session_submissions_unique_attempt
      to class_lab_submissions_unique_attempt;
  end if;
end $$;

alter table public.grading_sessions
  drop constraint if exists grading_sessions_status_check,
  drop column status,
  drop column name;

alter table public.grading_sessions rename to class_labs;

do $$
begin
  if to_regclass('public.grading_sessions_class_idx') is not null then
    alter index public.grading_sessions_class_idx rename to class_labs_class_idx;
  end if;
end $$;

alter table public.class_labs
  add constraint class_labs_class_id_lab_id_key unique (class_id, lab_id);

-- Restore the old submission RPC without the request-fulfilment dependency. If the old
-- workflow is also being restored, replace this function with the archived pre-migration
-- definition after restoring request processing.
create function public.create_class_lab_submission(
  p_class_student_id uuid,
  p_class_lab_id uuid,
  p_item_type text,
  p_source_url text,
  p_score numeric,
  p_details jsonb default null,
  p_fulfills_request_id uuid default null
)
returns public.class_lab_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key1 int;
  v_key2 int;
  v_attempt_no int;
  v_status text;
  v_row public.class_lab_submissions;
begin
  v_key1 := hashtextextended(p_class_student_id::text, 0)::bit(32)::int;
  v_key2 := hashtextextended(p_class_lab_id::text, 0)::bit(32)::int;
  perform pg_advisory_xact_lock(v_key1, v_key2);

  select coalesce(max(attempt_no), 0) + 1
  into v_attempt_no
  from public.class_lab_submissions
  where class_student_id = p_class_student_id and class_lab_id = p_class_lab_id;

  v_status := case when coalesce(p_score, 0) >= 5.0 then 'passed' else 'failed' end;

  insert into public.class_lab_submissions (
    class_student_id, class_lab_id, attempt_no, item_type,
    source_url, score, status, details, graded_at
  ) values (
    p_class_student_id, p_class_lab_id, v_attempt_no, p_item_type,
    p_source_url, p_score, v_status, p_details, now()
  )
  returning * into v_row;

  if p_fulfills_request_id is not null then
    update public.resubmission_requests_v2
    set created_submission_id = v_row.id,
        updated_at = now()
    where id = p_fulfills_request_id;
  end if;

  return v_row;
end;
$$;

commit;
