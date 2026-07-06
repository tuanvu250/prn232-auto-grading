-- Phase 2 step 9 — post-apply reconciliation. Compare this output against the "expected.*"
-- rows produced by 2026-07-04-migration-dry-run.sql before the apply ran.

select 'actual.students' as target, count(*) as actual_count from students
union all
select 'actual.classes', count(*) from classes
union all
select 'actual.labs', count(*) from labs
union all
select 'actual.class_lab_submissions', count(*) from class_lab_submissions
union all
select 'actual.resubmission_requests_v2', count(*) from resubmission_requests_v2;

-- Any old submissions row that failed to map (missing student/class/lab join) — should be
-- empty; investigate and fix mapping before considering migration complete.
select sub.student_id, sub.lab_id, sub.class_name
from submissions sub
left join students s on s.student_code = upper(btrim(sub.student_id))
left join class_lab_submissions cls on cls.class_student_id in (
  select cs.id from class_students cs where cs.student_id = s.id
)
where s.id is null or cls.id is null;

-- Any old resubmission_requests row that failed to reattach — should be empty.
select rr.*
from resubmission_requests rr
left join resubmission_requests_v2 v2 on v2.drive_link = rr.drive_link
  and v2.created_at = rr.created_at
where v2.id is null;
