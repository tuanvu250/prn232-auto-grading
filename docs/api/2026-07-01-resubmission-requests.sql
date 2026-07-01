create table if not exists resubmission_requests (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  email text not null,
  name text,
  class_name text,
  lab_id text not null,
  drive_link text not null,
  note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by text,
  constraint resubmission_status_check check (status in ('pending', 'completed'))
);

create unique index if not exists resubmission_one_pending_per_lab
on resubmission_requests (student_id, lab_id)
where status = 'pending';

create index if not exists resubmission_requests_status_updated_idx
on resubmission_requests (status, updated_at desc);

create index if not exists resubmission_requests_student_idx
on resubmission_requests (student_id, updated_at desc);
