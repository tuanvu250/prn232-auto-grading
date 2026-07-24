-- Backfill missing submissions in a new grading session from the previous
-- session of the same class and lab.
--
-- Intended usage:
--   1. Grading tool syncs every available student result with create_session_submission.
--   2. Grading tool calls backfill_missing_session_submissions_from_previous(session_id).
--   3. Students still missing in the new session receive the latest score from the
--      newest earlier session for the same class/lab.

begin;

do $$
begin
  if to_regclass('public.grading_sessions') is null
     or to_regclass('public.session_submissions') is null
     or to_regclass('public.class_students') is null then
    raise exception 'backfill_missing_session_submissions_missing_tables';
  end if;
end $$;

create or replace function public.backfill_missing_session_submissions_from_previous(
  p_grading_session_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted_count integer;
begin
  if not exists (
    select 1
    from public.grading_sessions gs
    where gs.id = p_grading_session_id
      and gs.status = 'open'
      and (gs.deadline is null or gs.deadline > now())
  ) then
    raise exception 'grading_session_not_open_or_deadline_passed'
      using errcode = 'P0001';
  end if;

  with target_session as (
    select id, class_id, lab_id, created_at
    from public.grading_sessions
    where id = p_grading_session_id
  ),
  missing_students as (
    select
      cs.id as class_student_id,
      target_session.class_id,
      target_session.lab_id,
      target_session.created_at as target_created_at
    from target_session
    join public.class_students cs
      on cs.class_id = target_session.class_id
    where not exists (
      select 1
      from public.session_submissions current_sub
      where current_sub.grading_session_id = target_session.id
        and current_sub.class_student_id = cs.id
    )
  ),
  previous_latest as (
    select
      missing_students.class_student_id,
      previous_submission.id as source_submission_id,
      previous_submission.grading_session_id as source_grading_session_id,
      previous_submission.source_url,
      previous_submission.score,
      previous_submission.status,
      previous_submission.details
    from missing_students
    join lateral (
      select previous_sub.*
      from public.grading_sessions previous_session
      join public.session_submissions previous_sub
        on previous_sub.grading_session_id = previous_session.id
       and previous_sub.class_student_id = missing_students.class_student_id
      where previous_session.class_id = missing_students.class_id
        and previous_session.lab_id = missing_students.lab_id
        and previous_session.id <> p_grading_session_id
        and previous_session.created_at < missing_students.target_created_at
      order by previous_session.created_at desc, previous_sub.attempt_no desc
      limit 1
    ) previous_submission on true
  )
  insert into public.session_submissions (
    class_student_id,
    grading_session_id,
    attempt_no,
    item_type,
    source_url,
    score,
    status,
    details,
    graded_at
  )
  select
    previous_latest.class_student_id,
    p_grading_session_id,
    1,
    'original',
    previous_latest.source_url,
    previous_latest.score,
    previous_latest.status,
    coalesce(previous_latest.details, '{}'::jsonb) || jsonb_build_object(
      'copied_from_submission_id', previous_latest.source_submission_id,
      'copied_from_grading_session_id', previous_latest.source_grading_session_id,
      'copied_reason', 'missing_submission_backfill'
    ),
    now()
  from previous_latest
  on conflict do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

revoke all on function public.backfill_missing_session_submissions_from_previous(uuid)
  from public, anon, authenticated;
grant execute on function public.backfill_missing_session_submissions_from_previous(uuid)
  to service_role;

comment on function public.backfill_missing_session_submissions_from_previous(uuid) is
  'Copies latest scores from the newest earlier session of the same class/lab for students missing in the target session.';

commit;
