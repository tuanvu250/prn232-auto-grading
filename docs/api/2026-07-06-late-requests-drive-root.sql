-- Adds the Drive-root submission window and late-request support without renaming
-- resubmission_requests_v2.

alter table class_labs
  add column if not exists drive_root_url text;

alter table resubmission_requests_v2
  add column if not exists request_type text not null default 'resubmit';

alter table resubmission_requests_v2
  alter column submission_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resubmission_requests_v2_request_type_check'
  ) then
    alter table resubmission_requests_v2
      add constraint resubmission_requests_v2_request_type_check
      check (request_type in ('late', 'resubmit'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'resubmission_requests_v2_submission_required_check'
  ) then
    alter table resubmission_requests_v2
      add constraint resubmission_requests_v2_submission_required_check
      check (request_type <> 'resubmit' or submission_id is not null);
  end if;
end $$;

drop index if exists resubmission_requests_v2_lookup_idx;
create index if not exists resubmission_requests_v2_lookup_idx
  on resubmission_requests_v2 (class_student_id, class_lab_id, request_type, status);

create or replace function create_resubmission_request(
  p_class_student_id uuid,
  p_class_lab_id uuid,
  p_submission_id uuid,
  p_drive_link text,
  p_note text default null,
  p_request_type text default 'resubmit'
)
returns resubmission_requests_v2
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key1 int;
  v_key2 int;
  v_used_count int;
  v_row resubmission_requests_v2;
begin
  if p_request_type not in ('late', 'resubmit') then
    raise exception 'invalid_request_type' using errcode = 'P0001';
  end if;

  if p_request_type = 'resubmit' and p_submission_id is null then
    raise exception 'submission_required_for_resubmit' using errcode = 'P0001';
  end if;

  v_key1 := hashtextextended(p_class_student_id::text, 0)::bit(32)::int;
  v_key2 := hashtextextended(p_class_lab_id::text, 0)::bit(32)::int;
  perform pg_advisory_xact_lock(v_key1, v_key2);

  if p_request_type = 'resubmit' then
    select
      (select count(*) from resubmission_requests_v2
        where class_student_id = p_class_student_id
          and class_lab_id = p_class_lab_id
          and request_type = 'resubmit'
          and status in ('pending', 'approved')
          and created_submission_id is null)
      +
      (select count(*) from class_lab_submissions
        where class_student_id = p_class_student_id
          and class_lab_id = p_class_lab_id
          and item_type = 'resubmit')
    into v_used_count;

    if v_used_count >= 3 then
      raise exception 'resubmission_limit_reached' using errcode = 'P0001';
    end if;
  end if;

  insert into resubmission_requests_v2 (
    class_student_id,
    class_lab_id,
    submission_id,
    drive_link,
    note,
    status,
    request_type
  )
  values (
    p_class_student_id,
    p_class_lab_id,
    p_submission_id,
    p_drive_link,
    p_note,
    'pending',
    p_request_type
  )
  returning * into v_row;

  return v_row;
end;
$$;

drop function if exists student_class_lab_overview(uuid);

create function student_class_lab_overview(p_class_student_id uuid)
returns table (
  class_lab_id uuid,
  lab_code text,
  lab_title text,
  deadline timestamptz,
  drive_root_url text,
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
    cl.drive_root_url,
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
  group by cl.id, l.code, l.title, cl.deadline, cl.drive_root_url
  order by l.code;
$$;
