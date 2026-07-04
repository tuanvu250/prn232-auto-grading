-- Phase 2 step 2 — dry-run reconciliation (plans/260704-normalize-grading-erd/phase-02-migration-dry-run-apply.md)
-- Counts only — inserts nothing. Run on a staging copy first, then again against production
-- immediately before the real apply script, and compare the two runs' output.

-- Old-side counts
select 'old.allowed_emails' as source, count(*) as row_count from allowed_emails
union all
select 'old.submissions', count(*) from submissions
union all
select 'old.resubmission_requests', count(*) from resubmission_requests;

-- Distinct old lab codes after normalization (uppercase, trimmed) — review this list by hand
-- before the real apply: this is the mapping surface for step 1 (lab_id/lab_code cleanup).
select distinct upper(btrim(lab_id)) as normalized_lab_code, count(*) as usage_count
from submissions
group by 1
order by 1;

-- Distinct old class names — review by hand for the term/class inference in step 5.
select distinct upper(btrim(class_name)) as normalized_class_name, count(*) as usage_count
from allowed_emails
group by 1
order by 1;

-- Expected row counts in the new schema after apply:
select 'expected.students' as target, count(distinct lower(btrim(email))) as expected_count
from allowed_emails
union all
select 'expected.classes', count(distinct upper(btrim(class_name)))
from allowed_emails
union all
select 'expected.labs', count(distinct upper(btrim(lab_id)))
from submissions
union all
select 'expected.class_lab_submissions (attempt_no=1 each)', count(*)
from submissions
union all
select 'expected.resubmission_requests_v2', count(*)
from resubmission_requests;

-- Known-duplicate check: old submissions PK is (student_id, lab_id), so no duplicates possible
-- there by construction. Flag any allowed_emails rows sharing an email with different
-- student_id/class_name (would indicate dirty whitelist data) before mapping to STUDENTS.
select email, count(distinct student_id) as distinct_student_ids, count(distinct class_name) as distinct_classes
from allowed_emails
group by email
having count(distinct student_id) > 1 or count(distinct class_name) > 1;
