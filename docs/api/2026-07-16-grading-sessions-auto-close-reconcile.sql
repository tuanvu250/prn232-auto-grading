-- Expected result: every check returns true and expired_open_count is zero.

select
  to_regprocedure('public.close_expired_grading_sessions()') is not null
    as close_function_exists,
  to_regprocedure('public.reject_submission_outside_session_window()') is not null
    as guard_function_exists;

select exists (
  select 1
  from pg_trigger
  where tgrelid = 'public.session_submissions'::regclass
    and tgname = 'reject_submission_outside_session_window'
    and not tgisinternal
) as submission_guard_exists;

select count(*) as expired_open_count
from public.grading_sessions
where status = 'open'
  and deadline is not null
  and deadline <= now();

select
  jobid,
  jobname,
  schedule,
  command,
  active
from cron.job
where jobname = 'close-expired-grading-sessions';

select
  status,
  return_message,
  start_time,
  end_time
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'close-expired-grading-sessions'
)
order by start_time desc
limit 5;
