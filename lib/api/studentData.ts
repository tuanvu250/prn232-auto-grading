export interface TestcaseResult {
  name: string;
  status: "pass" | "fail" | "pending";
  message?: string;
  expected?: string;
  actual?: string;
  score?: number;
  maxScore?: number;
  actualResponse?: string | null;
  actualStatusCode?: number | null;
}

export interface SubmissionHistory {
  version: number;
  submittedAt: string;
  score: number;
  status: "Passed" | "Failed" | "Grading";
  testcasesPassed: number;
  testcasesTotal: number;
  buildLogs: string;
  testcaseDetails: TestcaseResult[];
}

export interface LabAssignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: "Passed" | "Failed" | "Grading" | "NotSubmitted";
  currentScore: number;
  weight: number; // Grade weight, for example 10%.
  submissions: SubmissionHistory[];
}
