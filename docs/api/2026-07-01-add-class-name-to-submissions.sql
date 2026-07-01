alter table submissions
add column if not exists class_name text;

update submissions s
set class_name = ae.class_name
from allowed_emails ae
where s.student_id = ae.student_id
  and s.class_name is null;

create index if not exists submissions_lab_class_idx
on submissions (lab_id, class_name);
