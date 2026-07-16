-- Automatically close grading sessions after their deadline.
-- Safe to run repeatedly: functions and trigger are replaced, while pg_cron
-- overwrites an existing job with the same name.

begin;

do $$
begin
  if to_regclass('public.grading_sessions') is null
     or to_regclass('public.session_submissions') is null then
    raise exception 'grading_sessions_auto_close_missing_tables';
  end if;
end $$;

create extension if not exists pg_cron;

create or replace function public.close_expired_grading_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed_count integer;
begin
  update public.grading_sessions
  set status = 'closed'
  where status = 'open'
    and deadline is not null
    and deadline <= now();

  get diagnostics v_closed_count = row_count;
  return v_closed_count;
end;
$$;

revoke all on function public.close_expired_grading_sessions()
  from public, anon, authenticated;
grant execute on function public.close_expired_grading_sessions()
  to service_role;

comment on function public.close_expired_grading_sessions() is
  'Closes every open grading session whose deadline has passed.';

create or replace function public.reject_submission_outside_session_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_deadline timestamptz;
begin
  select gs.status, gs.deadline
  into v_status, v_deadline
  from public.grading_sessions gs
  where gs.id = new.grading_session_id;

  if not found then
    raise exception 'grading_session_not_found'
      using errcode = '23503';
  end if;

  if v_status <> 'open' then
    raise exception 'grading_session_not_open'
      using errcode = 'P0001';
  end if;

  if v_deadline is not null and v_deadline <= now() then
    raise exception 'grading_session_deadline_passed'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_submission_outside_session_window()
  from public, anon, authenticated;

drop trigger if exists reject_submission_outside_session_window
  on public.session_submissions;
create trigger reject_submission_outside_session_window
before insert on public.session_submissions
for each row
execute function public.reject_submission_outside_session_window();

comment on function public.reject_submission_outside_session_window() is
  'Rejects new attempts when their grading session is closed or past deadline.';

-- Reconcile existing overdue rows before the recurring job starts.
select public.close_expired_grading_sessions();

-- Supabase Cron replaces a job when cron.schedule receives the same job name.
select cron.schedule(
  'close-expired-grading-sessions',
  '* * * * *',
  'select public.close_expired_grading_sessions();'
);

commit;
