-- Phase 2 step 5-8 — real migration apply (plans/260704-normalize-grading-erd/phase-02-migration-dry-run-apply.md)
--
-- PREREQUISITES (do not run until both are true):
--   1. The old `be` sync tool worker is confirmed stopped (queue still accepts jobs, worker
--      paused — see phase-02 step 3). Get written/chat confirmation of who stopped it and when.
--   2. A restorable Supabase backup/snapshot (point-in-time recovery or manual snapshot) has
--      been confirmed to exist. This step is mandatory, not optional.
--
-- Run 2026-07-04-normalize-erd-schema.sql first if not already applied.
--
-- Known limitation: the old `submissions` table has no submitted_at column, only updated_at
-- (last-write timestamp, since it was UPSERT-overwritten on every regrade). We use updated_at
-- as the best-effort proxy for submitted_at when deriving item_type below — this is a known,
-- accepted precision loss for backfilled rows (documented in Phase 2 Risks); it does not affect
-- new rows going forward, which get a real submitted_at at insert time.

begin;

-- 5a. Infer exactly one current term and create it. All existing production data lives under
-- a single term, SU26 (2026-05-11 -> 2026-08-30), confirmed by the admin before this run.
insert into terms (name, starts_on, ends_on)
values ('SU26', date '2026-05-11', date '2026-08-30')
on conflict (name) do nothing;

-- 5b. One class row per distinct normalized class_name, attached to that term.
insert into classes (term_id, name)
select t.id, distinct_class.normalized_name
from (
  select distinct upper(btrim(class_name)) as normalized_name
  from allowed_emails
  where btrim(coalesce(class_name, '')) <> ''
) distinct_class
cross join (select id from terms where name = 'SU26') t
on conflict (term_id, name) do nothing;

-- 5c. Students + class membership from the allowed_emails whitelist.
insert into students (email, student_code, name)
select lower(btrim(email)), upper(btrim(student_id)), null
from allowed_emails
on conflict (email) do nothing;

insert into class_students (class_id, student_id)
select c.id, s.id
from allowed_emails ae
join students s on s.email = lower(btrim(ae.email))
join classes c on c.name = upper(btrim(ae.class_name))
  and c.term_id = (select id from terms where name = 'SU26')
on conflict (class_id, student_id) do nothing;

-- 5d. One lab catalog row per distinct normalized lab code, then assign it to every class that
-- has ever used it (deadline left null — set manually per class/lab after migration if known).
insert into labs (code, title)
select distinct upper(btrim(lab_id)), null
from submissions
on conflict (code) do nothing;

insert into class_labs (class_id, lab_id, deadline)
select distinct c.id, l.id, null::timestamptz
from submissions sub
join students s on s.student_code = upper(btrim(sub.student_id))
join class_students cs on cs.student_id = s.id
join classes c on c.id = cs.class_id
join labs l on l.code = upper(btrim(sub.lab_id))
on conflict (class_id, lab_id) do nothing;

-- 6. One class_lab_submissions row per (student, lab) with attempt_no=1. Direct insert,
-- deliberately bypassing create_class_lab_submission()'s advisory lock — this is a one-time,
-- intentional exception that is only safe because the `be` sync tool is fully stopped (no
-- concurrent writer exists during this migration). Do not reuse this direct-insert pattern
-- anywhere else. item_type is derived per-row from updated_at vs. the mapped class_labs
-- deadline (before deadline => original, after => late; unknown deadline => original).
insert into class_lab_submissions (
  class_student_id, class_lab_id, attempt_no, item_type, score, status, details,
  submitted_at, graded_at
)
select
  cs.id,
  cl.id,
  1,
  case
    when cl.deadline is null then 'original'
    when sub.updated_at <= cl.deadline then 'original'
    else 'late'
  end,
  sub.score,
  case when coalesce(sub.score, 0) >= 5.0 then 'passed' else 'failed' end,
  sub.details,
  sub.updated_at,
  sub.updated_at
from submissions sub
join students s on s.student_code = upper(btrim(sub.student_id))
join class_students cs on cs.student_id = s.id
join classes c on c.id = cs.class_id
  and c.term_id = (select id from terms where name = 'SU26')
join labs l on l.code = upper(btrim(sub.lab_id))
join class_labs cl on cl.class_id = c.id and cl.lab_id = l.id
on conflict (class_student_id, class_lab_id, attempt_no) do nothing;

-- 7. Reattach old resubmission requests to the matching new class_lab_submissions row.
insert into resubmission_requests_v2 (
  class_student_id, class_lab_id, submission_id, drive_link, note, admin_note, status,
  created_at, updated_at, completed_at, completed_by
)
select
  cs.id, cl.id, cls.id, rr.drive_link, rr.note, rr.admin_note, rr.status,
  rr.created_at, rr.updated_at, rr.completed_at, rr.completed_by
from resubmission_requests rr
join students s on s.student_code = upper(btrim(rr.student_id))
join class_students cs on cs.student_id = s.id
join labs l on l.code = upper(btrim(rr.lab_id))
join class_labs cl on cl.lab_id = l.id and cl.class_id = cs.class_id
join class_lab_submissions cls on cls.class_student_id = cs.id and cls.class_lab_id = cl.id;

commit;

-- 8. Validate FK integrity without a long table lock (NOT VALID then VALIDATE separately).
-- The FKs declared inline in 2026-07-04-normalize-erd-schema.sql are already validated at
-- creation time for the (empty) new tables; re-run the block below only if you added any FK
-- after this apply ran (kept here for reference / re-use on future backfills).
--
-- alter table class_lab_submissions
--   add constraint class_lab_submissions_class_student_fk
--   foreign key (class_student_id) references class_students (id) not valid;
-- alter table class_lab_submissions
--   validate constraint class_lab_submissions_class_student_fk;
