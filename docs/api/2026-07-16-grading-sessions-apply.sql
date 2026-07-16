-- Grading sessions migration: phase 1 schema cutover.
-- Prerequisites:
--   * grading sync is paused;
--   * 2026-07-16-grading-sessions-preflight.sql has no integrity failures;
--   * resubmission_requests and resubmission_requests_v2 were exported;
--   * the application release using the new relation/RPC names is ready to deploy.
-- This phase deliberately retains both request tables for audit and rollback.

begin;

do $$
begin
  if to_regclass('public.class_labs') is null
     or to_regclass('public.class_lab_submissions') is null then
    raise exception 'grading_sessions_migration_missing_source_tables';
  end if;

  if to_regclass('public.grading_sessions') is not null
     or to_regclass('public.session_submissions') is not null then
    raise exception 'grading_sessions_migration_target_tables_already_exist';
  end if;

  if exists (
    select 1
    from public.class_lab_submissions sub
    join public.class_students cs on cs.id = sub.class_student_id
    join public.class_labs cl on cl.id = sub.class_lab_id
    where cs.class_id <> cl.class_id
  ) then
    raise exception 'grading_sessions_migration_cross_class_submission';
  end if;
end $$;

lock table public.class_labs in access exclusive mode;
lock table public.class_lab_submissions in access exclusive mode;

-- The old RPC body contains relation names as text and cannot survive the rename safely.
drop function if exists public.create_class_lab_submission(uuid, uuid, text, text, numeric, jsonb, uuid);

-- Remove UNIQUE(class_id, lab_id) without depending on its generated name.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.class_labs'::regclass
      and c.contype = 'u'
      and (
        select array_agg(a.attname order by k.ordinality)
        from unnest(c.conkey) with ordinality as k(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = c.conrelid and a.attnum = k.attnum
      ) = array['class_id', 'lab_id']::name[]
  loop
    execute format('alter table public.class_labs drop constraint %I', v_constraint.conname);
  end loop;
end $$;

alter table public.class_labs rename to grading_sessions;

alter table public.grading_sessions
  add column name text,
  add column status text not null default 'open';

update public.grading_sessions gs
set
  name = coalesce(nullif(btrim(l.code), ''), 'Lab') || ' - Đợt 1',
  status = case
    when gs.deadline is not null and gs.deadline < now() then 'closed'
    else 'open'
  end
from public.labs l
where l.id = gs.lab_id;

do $$
begin
  if exists (select 1 from public.grading_sessions where name is null) then
    raise exception 'grading_sessions_migration_name_backfill_failed';
  end if;
end $$;

alter table public.grading_sessions
  alter column name set not null,
  add constraint grading_sessions_status_check check (status in ('open', 'closed'));

create unique index grading_sessions_one_open_per_class_lab_idx
  on public.grading_sessions (class_id, lab_id)
  where status = 'open';

do $$
begin
  if to_regclass('public.class_labs_class_idx') is not null then
    alter index public.class_labs_class_idx rename to grading_sessions_class_idx;
  end if;
end $$;

alter table public.class_lab_submissions rename to session_submissions;
alter table public.session_submissions rename column class_lab_id to grading_session_id;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.session_submissions'::regclass
      and conname = 'class_lab_submissions_class_lab_id_fkey'
  ) then
    alter table public.session_submissions
      rename constraint class_lab_submissions_class_lab_id_fkey
      to session_submissions_grading_session_id_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.session_submissions'::regclass
      and conname = 'class_lab_submissions_class_student_id_fkey'
  ) then
    alter table public.session_submissions
      rename constraint class_lab_submissions_class_student_id_fkey
      to session_submissions_class_student_id_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.session_submissions'::regclass
      and conname = 'class_lab_submissions_item_type_check'
  ) then
    alter table public.session_submissions
      rename constraint class_lab_submissions_item_type_check
      to session_submissions_item_type_check;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.session_submissions'::regclass
      and conname = 'class_lab_submissions_status_check'
  ) then
    alter table public.session_submissions
      rename constraint class_lab_submissions_status_check
      to session_submissions_status_check;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.session_submissions'::regclass
      and conname = 'class_lab_submissions_attempt_no_positive'
  ) then
    alter table public.session_submissions
      rename constraint class_lab_submissions_attempt_no_positive
      to session_submissions_attempt_no_positive;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.session_submissions'::regclass
      and conname = 'class_lab_submissions_unique_attempt'
  ) then
    alter table public.session_submissions
      rename constraint class_lab_submissions_unique_attempt
      to session_submissions_unique_attempt;
  end if;
end $$;

do $$
begin
  if to_regclass('public.class_lab_submissions_lookup_idx') is not null then
    alter index public.class_lab_submissions_lookup_idx
      rename to session_submissions_lookup_idx;
  end if;
end $$;

-- A grading write is valid only when the student belongs to the session's class and
-- the session is open. New writes are always original; legacy item_type values remain intact.
create function public.create_session_submission(
  p_class_student_id uuid,
  p_grading_session_id uuid,
  p_source_url text,
  p_score numeric,
  p_details jsonb default null
)
returns public.session_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key1 int;
  v_key2 int;
  v_attempt_no int;
  v_status text;
  v_row public.session_submissions;
begin
  if not exists (
    select 1
    from public.grading_sessions gs
    join public.class_students cs
      on cs.id = p_class_student_id and cs.class_id = gs.class_id
    where gs.id = p_grading_session_id
      and gs.status = 'open'
  ) then
    raise exception 'grading_session_not_open_or_student_not_enrolled'
      using errcode = 'P0001';
  end if;

  v_key1 := hashtextextended(p_class_student_id::text, 0)::bit(32)::int;
  v_key2 := hashtextextended(p_grading_session_id::text, 0)::bit(32)::int;
  perform pg_advisory_xact_lock(v_key1, v_key2);

  select coalesce(max(attempt_no), 0) + 1
  into v_attempt_no
  from public.session_submissions
  where class_student_id = p_class_student_id
    and grading_session_id = p_grading_session_id;

  v_status := case when coalesce(p_score, 0) >= 5.0 then 'passed' else 'failed' end;

  insert into public.session_submissions (
    class_student_id,
    grading_session_id,
    attempt_no,
    item_type,
    source_url,
    score,
    status,
    details,
    graded_at
  ) values (
    p_class_student_id,
    p_grading_session_id,
    v_attempt_no,
    'original',
    p_source_url,
    p_score,
    v_status,
    p_details,
    now()
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_session_submission(uuid, uuid, text, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_session_submission(uuid, uuid, text, numeric, jsonb)
  to service_role;

comment on table public.grading_sessions is
  'Independent grading/submission windows for one class and one lab.';
comment on table public.session_submissions is
  'Permanent grading attempts belonging directly to a grading session.';

commit;

-- Keep resubmission_requests_v2 and resubmission_requests until application and grading
-- sync verification is complete. Their foreign keys continue to reference the renamed
-- tables by OID, but no new workflow should use them after cutover.
