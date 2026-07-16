-- Grading sessions migration: read-only preflight.
-- Run and save the complete result before applying the migration.

select
  to_regclass('public.class_labs') as source_sessions,
  to_regclass('public.class_lab_submissions') as source_submissions,
  to_regclass('public.grading_sessions') as target_sessions,
  to_regclass('public.session_submissions') as target_submissions;

select 'class_labs' as relation, count(*) as row_count from public.class_labs
union all
select 'class_lab_submissions', count(*) from public.class_lab_submissions
union all
select 'resubmission_requests_v2', count(*) from public.resubmission_requests_v2
union all
select 'resubmission_requests', count(*) from public.resubmission_requests;

-- All four values must be zero.
select
  count(*) filter (where c.id is null) as sessions_with_missing_class,
  count(*) filter (where l.id is null) as sessions_with_missing_lab
from public.class_labs cl
left join public.classes c on c.id = cl.class_id
left join public.labs l on l.id = cl.lab_id;

select
  count(*) filter (where cs.id is null) as submissions_with_missing_student_membership,
  count(*) filter (where cl.id is null) as submissions_with_missing_session
from public.class_lab_submissions sub
left join public.class_students cs on cs.id = sub.class_student_id
left join public.class_labs cl on cl.id = sub.class_lab_id;

-- Must return no rows. A row means a student submission is attached to another class.
select sub.id, sub.class_student_id, sub.class_lab_id
from public.class_lab_submissions sub
join public.class_students cs on cs.id = sub.class_student_id
join public.class_labs cl on cl.id = sub.class_lab_id
where cs.class_id <> cl.class_id;

-- Resolve these requests operationally before the resubmission table is dropped in phase 3.
select request_type, status, count(*) as request_count
from public.resubmission_requests_v2
where status in ('pending', 'approved')
group by request_type, status
order by request_type, status;

-- Record the source constraint/index names for audit and rollback.
select c.conname, c.contype, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid in ('public.class_labs'::regclass, 'public.class_lab_submissions'::regclass)
order by c.conrelid::regclass::text, c.conname;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('class_labs', 'class_lab_submissions')
order by tablename, indexname;
