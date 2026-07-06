export interface Term {
  id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
}

export interface ClassRow {
  id: string;
  term_id: string;
  name: string;
}

export interface Lab {
  id: string;
  code: string;
  title: string | null;
}

export interface ClassLab {
  id: string;
  class_id: string;
  lab_id: string;
  deadline: string | null;
  lab_code: string;
  lab_title: string | null;
}

export interface StudentRow {
  id: string;
  email: string;
  student_code: string;
  name: string | null;
}

export interface ClassStudentRosterRow {
  class_student_id: string;
  student_id: string;
  student_code: string;
  student_name: string | null;
  student_email: string;
}

export type SubmissionItemType = "original" | "late" | "resubmit";
export type SubmissionStatus = "grading" | "passed" | "failed";

export interface SubmissionTestcase {
  name?: string;
  passed?: boolean;
  error?: string | null;
  score?: number;
  max_score?: number;
  actual_response?: string | null;
  actual_status_code?: number | null;

  // Fields from buildSyncDetails / JSON
  method?: string;
  httpMethod?: string;
  url?: string;
  urlTemplate?: string;
  awardedScore?: number;
  effectiveScore?: number;
  statusCode?: number | null;
  actualStatusCode?: number | null;
  errorMessage?: string | null;
  actualResponse?: string | null;
  manualOverrideScore?: number | null;
  overrideReason?: string | null;
}

export interface SubmissionDetails {
  tests?: SubmissionTestcase[];
  results?: SubmissionTestcase[];
  passed?: number;
  total?: number;
  build_logs?: string;
  buildLogs?: string;
  log?: string;
  jobStatus?: string;
  totalScore?: number;
  latestJobId?: string;
  studentCode?: string;
  submissionId?: string;
  submissionStatus?: string;
}

export interface ClassLabSubmission {
  id: string;
  class_student_id: string;
  class_lab_id: string;
  attempt_no: number;
  item_type: SubmissionItemType;
  source_url: string | null;
  score: number | null;
  status: SubmissionStatus;
  details: SubmissionDetails | null;
  submitted_at: string;
  graded_at: string | null;
}

export type ResubmissionRequestStatus = "pending" | "approved" | "rejected" | "completed";

export interface ResubmissionRequestV2 {
  id: string;
  class_student_id: string;
  class_lab_id: string;
  submission_id: string;
  created_submission_id: string | null;
  drive_link: string;
  note: string | null;
  admin_note: string | null;
  status: ResubmissionRequestStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  completed_by: string | null;
}

// One row per (class_student_id, class_lab_id) as returned by the
// admin_class_lab_student_results / student_class_lab_overview RPCs.
export interface ClassLabStudentResult {
  class_student_id: string;
  student_code: string;
  student_name: string | null;
  student_email: string;
  attempt_count: number;
  resubmit_count: number;
  latest_attempt_no: number | null;
  latest_score: number | null;
  latest_status: SubmissionStatus | null;
}

export interface StudentClassLabOverview {
  class_lab_id: string;
  lab_code: string;
  lab_title: string | null;
  deadline: string | null;
  attempt_count: number;
  latest_attempt_no: number | null;
  latest_score: number | null;
  latest_status: SubmissionStatus | null;
}
