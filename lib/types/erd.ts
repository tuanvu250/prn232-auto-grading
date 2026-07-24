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

export type GradingSessionStatus = "open" | "closed";

export interface GradingSession {
  id: string;
  class_id: string;
  lab_id: string;
  name: string;
  deadline: string | null;
  drive_root_url: string | null;
  status: GradingSessionStatus;
  created_at: string;
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
  manualOverride?: boolean;
  manualOverrideScore?: number;
  overrideReason?: string | null;
  overriddenAt?: string;
}

export interface SessionSubmission {
  id: string;
  class_student_id: string;
  grading_session_id: string;
  attempt_no: number;
  item_type: SubmissionItemType;
  source_url: string | null;
  score: number | null;
  status: SubmissionStatus;
  details: SubmissionDetails | null;
  submitted_at: string;
  graded_at: string | null;
  created_at: string;
}

export interface GradingSessionStudentResult {
  class_student_id: string;
  student_code: string;
  student_name: string | null;
  student_email: string;
  attempt_count: number;
  latest_attempt_no: number | null;
  latest_score: number | null;
  latest_status: SubmissionStatus | null;
}

export interface ClassGradeMatrixResult {
  class_student_id: string;
  grading_session_id: string;
  attempt_count: number;
  latest_attempt_no: number;
  latest_score: number | null;
  latest_status: SubmissionStatus;
}

export interface StudentGradingSessionOverview {
  grading_session_id: string;
  session_name: string;
  session_status: GradingSessionStatus;
  lab_code: string;
  lab_title: string | null;
  deadline: string | null;
  drive_root_url: string | null;
  attempt_count: number;
  latest_attempt_no: number | null;
  latest_score: number | null;
  latest_status: SubmissionStatus | null;
}
