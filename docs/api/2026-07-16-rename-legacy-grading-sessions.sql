-- Rename sessions created from the legacy class-lab data after the schema cutover.
-- Restrict the update to the generated suffix so manually named sessions are untouched.

update public.grading_sessions
set name = regexp_replace(name, ' - Dữ liệu cũ$', ' - Đợt 1')
where name like '% - Dữ liệu cũ';
