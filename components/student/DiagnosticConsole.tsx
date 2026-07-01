"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowUp,
  Clock,
  Code2,
  ExternalLink,
  RefreshCw,
  User as UserIcon,
} from "lucide-react";
import { LabAssignment, SubmissionHistory, TestcaseResult } from "@/lib/api/studentData";
import { UserPayload } from "@/lib/utils/auth";
import { ResubmissionRequest } from "./ResubmissionDialog";
import { StatusBadge } from "./StatusBadge";

interface DiagnosticConsoleProps {
  user: UserPayload;
  selectedLab: LabAssignment;
  selectedSubmission: SubmissionHistory | null;
  onSelectSubmission: (submission: SubmissionHistory) => void;
  resubmissions: ResubmissionRequest[];
  onOpenResubmissionDialog: () => void;
}

const parseTestcase = (tcName: string) => {
  const match = tcName.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    return {
      method: match[1].trim().toUpperCase(),
      rule: match[2].trim(),
    };
  }
  return {
    method: "TEST",
    rule: tcName,
  };
};

const getMethodBadge = (method: string) => {
  let colorClass = "bg-[#6b7280] text-white"; // default gray
  if (method === "SOURCE") {
    colorClass = "bg-[#9c27b0] text-white"; // Swagger purple for custom SOURCE
  } else if (method === "GET") {
    colorClass = "bg-[#61affe] text-white"; // Swagger blue
  } else if (method === "POST") {
    colorClass = "bg-[#49cc90] text-white"; // Swagger green
  } else if (method === "PUT") {
    colorClass = "bg-[#fca130] text-white"; // Swagger orange
  } else if (method === "DELETE") {
    colorClass = "bg-[#f93e3e] text-white"; // Swagger red
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-sm px-2 py-0.5 text-[10px] font-bold min-w-[52px] text-center tracking-wide ${colorClass}`}
    >
      {method}
    </span>
  );
};

const formatResponse = (response: string) => {
  try {
    const parsed = JSON.parse(response);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return response;
  }
};

const getSortedTestcases = (submission: SubmissionHistory) => {
  return [...submission.testcaseDetails].sort((a, b) => {
    const { method: methodA } = parseTestcase(a.name);
    const { method: methodB } = parseTestcase(b.name);
    const isSourceA = methodA === "SOURCE";
    const isSourceB = methodB === "SOURCE";

    if (isSourceA && !isSourceB) return -1;
    if (!isSourceA && isSourceB) return 1;
    return 0;
  });
};

export function DiagnosticConsole({
  user,
  selectedLab,
  selectedSubmission,
  onSelectSubmission,
  resubmissions,
  onOpenResubmissionDialog,
}: DiagnosticConsoleProps) {
  if (!selectedSubmission) {
    return (
      <Card className="border-border bg-card shadow-sm h-full flex flex-col justify-center items-center p-12 text-muted-foreground text-center">
        <p className="text-sm font-medium">No submission record selected</p>
      </Card>
    );
  }

  const currentRequest = resubmissions.find((request) => request.lab_id === selectedLab.id);

  const getResubmitButtonText = () => {
    if (!currentRequest) return "Request Resubmission";
    if (currentRequest.status === "pending") return "Pending Admin Review";
    if (currentRequest.status === "approved") return "Request Approved";
    if (currentRequest.status === "rejected") return "Request Rejected - Edit";
    return "Request Resubmission";
  };

  const getResubmitButtonVariant = () => {
    if (!currentRequest) return "outline";
    if (currentRequest.status === "approved") return "secondary";
    if (currentRequest.status === "rejected") return "destructive";
    return "secondary";
  };

  const isResubmissionDisabled = () => {
    if (!currentRequest) return false;
    return currentRequest.status === "approved" || currentRequest.status === "completed";
  };

  return (
    <Card className="border-border bg-card shadow-sm h-full flex flex-col">
      <CardContent className="min-w-0 flex-1 p-3 sm:p-6 space-y-6">
        {/* Submission Information Panel */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-6">
          <div className="min-w-0 space-y-1">
            <h3 className="break-words text-xl font-extrabold font-sans text-foreground tracking-tight sm:text-2xl">
              {user.studentId || "Student ID"}
            </h3>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
              <span>
                Status:{" "}
                <span className="font-semibold text-foreground">
                  {selectedSubmission.status}
                </span>
              </span>
              <span>•</span>
              <span>
                Total score:{" "}
                <span className="font-extrabold text-foreground">
                  {selectedSubmission.score.toFixed(2)} / 10
                </span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> At {selectedSubmission.submittedAt}
              </span>
            </div>
          </div>

          {/* Version selection dropdown */}
          {selectedLab.submissions.length > 1 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground font-medium">
                Submission version:
              </span>
              <select
                value={selectedSubmission.version}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  const sub = selectedLab.submissions.find((s) => s.version === v);
                  if (sub) onSelectSubmission(sub);
                }}
                className="rounded border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/30 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {selectedLab.submissions.map((sub) => (
                  <option key={sub.version} value={sub.version}>
                    Version {sub.version}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Diagnostic Metrics Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm transition-all hover:bg-muted/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Final Grade
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-foreground">
                {selectedSubmission.score.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">/ 10</span>
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm transition-all hover:bg-muted/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Testcases Passed
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-foreground">
                {selectedSubmission.testcasesPassed}
              </span>
              <span className="text-xs text-muted-foreground">
                / {selectedSubmission.testcasesTotal}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm transition-all hover:bg-muted/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Status
            </span>
            <div className="mt-2.5">
              <StatusBadge status={selectedSubmission.status} />
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm transition-all hover:bg-muted/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Action
            </span>
            <div className="mt-1.5">
              <Button
                variant={getResubmitButtonVariant()}
                size="sm"
                onClick={onOpenResubmissionDialog}
                disabled={isResubmissionDisabled()}
                className="w-full text-xs font-bold h-8 transition-transform duration-100 active:scale-95"
              >
                {getResubmitButtonText()}
              </Button>
            </div>
          </div>
        </div>

        {/* Build logs block */}
        {selectedSubmission.buildLogs &&
          (selectedSubmission.buildLogs.includes("error") ||
            selectedSubmission.buildLogs.includes("failed") ||
            selectedSubmission.buildLogs.includes("Exception")) && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                <TriangleAlert className="h-4 w-4" /> Build Diagnostic Logs
              </h4>
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-950/30 dark:bg-red-950/10">
                <pre className="overflow-x-auto font-mono text-xs text-red-800 dark:text-red-300 leading-relaxed whitespace-pre-wrap">
                  {selectedSubmission.buildLogs}
                </pre>
              </div>
            </div>
          )}

        {/* Testcases Logs and Console */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-sans text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
              <Code2 className="h-4 w-4 text-muted-foreground" /> Diagnostic Logs
            </h4>
            <span className="text-xs text-muted-foreground">
              Pass rate:{" "}
              {selectedSubmission.testcasesTotal > 0
                ? Math.round(
                    (selectedSubmission.testcasesPassed / selectedSubmission.testcasesTotal) * 100
                  )
                : 0}
              %
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[100px] text-xs font-bold">Method</TableHead>
                    <TableHead className="text-xs font-bold">Requirement / Path</TableHead>
                    <TableHead className="w-[80px] text-xs font-bold">Score</TableHead>
                    <TableHead className="w-[100px] text-right text-xs font-bold">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedSubmission.testcaseDetails.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                        No logs recorded for this submission.
                      </TableCell>
                    </TableRow>
                  ) : (
                    getSortedTestcases(selectedSubmission).map((tc, index) => {
                      const { method, rule } = parseTestcase(tc.name);
                      return (
                        <TableRow key={index} className="group hover:bg-muted/30 transition-colors">
                          <TableCell className="align-top py-3">{getMethodBadge(method)}</TableCell>
                          <TableCell className="align-top font-sans text-xs py-3 max-w-lg">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground whitespace-pre-wrap leading-relaxed">
                                {rule}
                              </p>
                              {tc.message && (
                                <div className="rounded bg-destructive/5 p-2.5 text-[11px] text-destructive leading-relaxed border border-destructive/10 whitespace-pre-wrap">
                                  {tc.message}
                                </div>
                              )}
                              {tc.actualResponse && (
                                <div className="mt-2 space-y-1">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                    Response Body
                                  </span>
                                  <pre className="rounded border border-border/80 bg-muted/40 p-2.5 font-mono text-[10px] text-muted-foreground overflow-x-auto leading-relaxed max-h-[160px] overflow-y-auto">
                                    {formatResponse(tc.actualResponse)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top py-3 text-xs font-semibold text-foreground">
                            {tc.score !== undefined && tc.maxScore !== undefined
                              ? `${tc.score}/${tc.maxScore}`
                              : "--"}
                          </TableCell>
                          <TableCell className="align-top text-right py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                                tc.status === "pass"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400"
                                  : "bg-red-500/10 text-red-600 dark:bg-red-500/5 dark:text-red-400"
                              }`}
                            >
                              {tc.status === "pass" ? "Passed" : "Failed"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Add mock/placeholder icon if TriangleAlert is not present in imports.
function TriangleAlert(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
