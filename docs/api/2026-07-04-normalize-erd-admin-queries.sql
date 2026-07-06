-- Phase 5/6 support RPCs — aggregate read views for the rebuilt admin/student dashboards.
-- Not part of the original phase-01 RPC list (create_class_lab_submission /
-- create_resubmission_request); added here because both dashboards need a grouped
-- "latest attempt + attempt count" rollup that is awkward to express as a single
-- PostgREST call without a dedicated function. Read-only, SECURITY INVOKER is fine
-- since supabaseServer already runs as service_role.

-- Admin: for one class_lab, one row per enrolled student with their latest attempt and
-- how many of their attempts were resubmissions.
create or replace function admin_class_lab_student_results(p_class_lab_id uuid)
returns table (
  class_student_id uuid,
  student_code text,
  student_name text,
  student_email text,
  attempt_count int,
  resubmit_count int,
  latest_attempt_no int,
  latest_score numeric,
  latest_status text
)
language sql
stable
as $$
  select
    cs.id as class_student_id,
    s.student_code,
    s.name as student_name,
    s.email as student_email,
    count(sub.id)::int as attempt_count,
    count(sub.id) filter (where sub.item_type = 'resubmit')::int as resubmit_count,
    (array_agg(sub.attempt_no order by sub.attempt_no desc))[1] as latest_attempt_no,
    (array_agg(sub.score order by sub.attempt_no desc))[1] as latest_score,
    (array_agg(sub.status order by sub.attempt_no desc))[1] as latest_status
  from class_students cs
  join students s on s.id = cs.student_id
  join class_labs cl on cl.id = p_class_lab_id
  left join class_lab_submissions sub
    on sub.class_student_id = cs.id and sub.class_lab_id = cl.id
  where cs.class_id = cl.class_id
  group by cs.id, s.student_code, s.name, s.email
  order by s.student_code;
$$;

-- Student: for one class_student, one row per class_lab assigned to their class, with
-- their latest attempt summary. Used to render the student's lab list dashboard.
create or replace function student_class_lab_overview(p_class_student_id uuid)
returns table (
  class_lab_id uuid,
  lab_code text,
  lab_title text,
  deadline timestamptz,
  attempt_count int,
  latest_attempt_no int,
  latest_score numeric,
  latest_status text
)
language sql
stable
as $$
  select
    cl.id as class_lab_id,
    l.code as lab_code,
    l.title as lab_title,
    cl.deadline,
    count(sub.id)::int as attempt_count,
    (array_agg(sub.attempt_no order by sub.attempt_no desc))[1] as latest_attempt_no,
    (array_agg(sub.score order by sub.attempt_no desc))[1] as latest_score,
    (array_agg(sub.status order by sub.attempt_no desc))[1] as latest_status
  from class_students cs
  join class_labs cl on cl.class_id = cs.class_id
  join labs l on l.id = cl.lab_id
  left join class_lab_submissions sub
    on sub.class_student_id = cs.id and sub.class_lab_id = cl.id
  where cs.id = p_class_student_id
  group by cl.id, l.code, l.title, cl.deadline
  order by l.code;
$$;
