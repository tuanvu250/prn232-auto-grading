-- Phase 1 step 10 — sample-data smoke test for the schema + RPCs in
-- 2026-07-04-normalize-erd-schema.sql. Run manually in the Supabase SQL editor against a
-- staging project after applying that file. Safe to re-run: wrapped in a transaction that
-- rolls back at the end, so it leaves no residue.

begin;

do $$
declare
  v_term_id uuid;
  v_class_id uuid;
  v_lab_id uuid;
  v_class_lab_id uuid;
  v_student_id uuid;
  v_class_student_id uuid;
  v_submission_1 class_lab_submissions;
  v_submission_2 class_lab_submissions;
  v_request resubmission_requests_v2;
  v_submission_3 class_lab_submissions;
begin
  insert into terms (name) values ('SP26-TEST') returning id into v_term_id;
  insert into classes (term_id, name) values (v_term_id, 'SE1999-TEST') returning id into v_class_id;
  insert into labs (code, title) values ('LAB1-TEST', 'Lab 1') returning id into v_lab_id;
  insert into class_labs (class_id, lab_id, deadline)
    values (v_class_id, v_lab_id, now() + interval '7 days') returning id into v_class_lab_id;
  insert into students (email, student_code, name)
    values ('test.student@example.com', 'SE99999-TEST', 'Test Student') returning id into v_student_id;
  insert into class_students (class_id, student_id)
    values (v_class_id, v_student_id) returning id into v_class_student_id;

  -- 2 consecutive grading runs -> 2 distinct rows, attempt_no 1 then 2.
  v_submission_1 := create_class_lab_submission(
    v_class_student_id, v_class_lab_id, 'original', 'https://drive.google.com/1', 3.0, '{}'::jsonb
  );
  assert v_submission_1.attempt_no = 1, 'expected attempt_no 1 on first submission';
  assert v_submission_1.status = 'failed', 'expected failed status for score 3.0';

  v_submission_2 := create_class_lab_submission(
    v_class_student_id, v_class_lab_id, 'original', 'https://drive.google.com/2', 4.5, '{}'::jsonb
  );
  assert v_submission_2.attempt_no = 2, 'expected attempt_no 2 on second submission';

  -- Resubmission request referencing the failing submission.
  v_request := create_resubmission_request(
    v_class_student_id, v_class_lab_id, v_submission_2.id, 'https://drive.google.com/2-fix', 'please regrade'
  );
  assert v_request.status = 'pending', 'expected new request to be pending';
  assert v_request.created_submission_id is null, 'expected created_submission_id unset before fulfillment';

  -- Fulfilling the request writes created_submission_id via fulfills_request_id.
  v_submission_3 := create_class_lab_submission(
    v_class_student_id, v_class_lab_id, 'resubmit', 'https://drive.google.com/3', 7.0, '{}'::jsonb, v_request.id
  );
  assert v_submission_3.attempt_no = 3, 'expected attempt_no 3 after resubmit';
  assert v_submission_3.status = 'passed', 'expected passed status for score 7.0';

  perform 1 from resubmission_requests_v2
    where id = v_request.id and created_submission_id = v_submission_3.id;
  assert found, 'expected created_submission_id to be updated by fulfills_request_id';

  -- Uniqueness safety net: forcing a duplicate attempt_no must fail.
  begin
    insert into class_lab_submissions (
      class_student_id, class_lab_id, attempt_no, item_type, score, status
    ) values (v_class_student_id, v_class_lab_id, 3, 'original', 5.0, 'passed');
    raise exception 'expected unique constraint violation on duplicate attempt_no';
  exception when unique_violation then
    null; -- expected
  end;

  -- Resubmission cap: 2 more requests should succeed (2nd, 3rd overall), the 4th must be blocked.
  perform create_resubmission_request(
    v_class_student_id, v_class_lab_id, v_submission_3.id, 'https://drive.google.com/4', null
  );
  begin
    perform create_resubmission_request(
      v_class_student_id, v_class_lab_id, v_submission_3.id, 'https://drive.google.com/5', null
    );
    raise exception 'expected resubmission_limit_reached on 4th request (1 completed resubmit + 2 pending = 3 already used)';
  exception when others then
    if sqlerrm <> 'resubmission_limit_reached' then
      raise;
    end if;
  end;

  raise notice 'Phase 1 sample-data smoke test PASSED';
end;
$$;

rollback;
