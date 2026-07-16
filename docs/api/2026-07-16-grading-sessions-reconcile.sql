-- Grading sessions migration: post-apply reconciliation.
-- Expected production baseline captured on 2026-07-16:
--   grading_sessions = 8, session_submissions = 358,
--   resubmission_requests_v2 = 6, resubmission_requests = 10.

select 'grading_sessions' as relation, count(*) as row_count from public.grading_sessions
union all
select 'session_submissions', count(*) from public.session_submissions
union all
select 'resubmission_requests_v2', count(*) from public.resubmission_requests_v2
union all
select 'resubmission_requests', count(*) from public.resubmission_requests;

-- All values must be zero.
select
  count(*) filter (where c.id is null) as sessions_with_missing_class,
  count(*) filter (where l.id is null) as sessions_with_missing_lab,
  count(*) filter (where nullif(btrim(gs.name), '') is null) as sessions_without_name,
  count(*) filter (where gs.status not in ('open', 'closed')) as sessions_with_invalid_status
from public.grading_sessions gs
left join public.classes c on c.id = gs.class_id
left join public.labs l on l.id = gs.lab_id;

select
  count(*) filter (where cs.id is null) as submissions_with_missing_student_membership,
  count(*) filter (where gs.id is null) as submissions_with_missing_session,
  count(*) filter (
    where cs.id is not null and gs.id is not null and cs.class_id <> gs.class_id
  ) as submissions_attached_to_another_class
from public.session_submissions sub
left join public.class_students cs on cs.id = sub.class_student_id
left join public.grading_sessions gs on gs.id = sub.grading_session_id;

-- Must return no rows.
select class_id, lab_id, count(*) as open_session_count
from public.grading_sessions
where status = 'open'
group by class_id, lab_id
having count(*) > 1;

-- Confirms the RPC and partial unique index exist.
select
  to_regprocedure('public.create_session_submission(uuid,uuid,text,numeric,jsonb)')
    as submission_rpc,
  to_regclass('public.grading_sessions_one_open_per_class_lab_idx')
    as one_open_index;

-- Request data must remain unchanged during phase 1.
select request_type, status, count(*) as request_count
from public.resubmission_requests_v2
group by request_type, status
order by request_type, status;
