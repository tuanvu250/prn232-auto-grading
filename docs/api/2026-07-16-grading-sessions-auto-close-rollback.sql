-- Removes automatic closing and the insert guard.
-- Sessions already closed by the job remain closed intentionally.

begin;

do $$
declare
  v_job_id bigint;
begin
  if to_regclass('cron.job') is not null then
    select jobid
    into v_job_id
    from cron.job
    where jobname = 'close-expired-grading-sessions';

    if v_job_id is not null then
      perform cron.unschedule(v_job_id);
    end if;
  end if;
end $$;

drop trigger if exists reject_submission_outside_session_window
  on public.session_submissions;
drop function if exists public.reject_submission_outside_session_window();
drop function if exists public.close_expired_grading_sessions();

commit;
