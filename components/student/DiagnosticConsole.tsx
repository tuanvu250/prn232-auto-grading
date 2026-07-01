"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Clock, ExternalLink, RefreshCw, TriangleAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LabAssignment, SubmissionHistory } from "@/lib/api/studentData";
import { UserPayload } from "@/lib/utils/auth";
import { createResubmissionAction } from "@/lib/actions/resubmissions";

export interface ResubmissionRequest {
  id: string;
  lab_id: string;
  drive_link: string;
  note?: string | null;
  admin_note?: string | null;
  status: "pending" | "approved" | "rejected" | "completed";
  updated_at: string;
  completed_at?: string | null;
}

interface DiagnosticConsoleProps {
  user: UserPayload;
  selectedLab: LabAssignment;
  selectedSubmission: SubmissionHistory | null;
  onSelectSubmission: (submission: SubmissionHistory) => void;
  resubmissions: ResubmissionRequest[];
  loadingResubmissions: boolean;
  onResubmissionSaved: (request: ResubmissionRequest) => void;
}

type SubmissionRequestKind = "late_first" | "resubmit";

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  } catch {
    return dateStr;
  }
};

const renderHighlightedRule = (rule: string) => {
  const parts = rule.split(/(\s+)/);
  return (
    <span className="[overflow-wrap:anywhere] break-words">
      {parts.map((part, index) => {
        const cleanPart = part.trim();
        const isEndpoint =
          cleanPart.startsWith("/") ||
          cleanPart.startsWith("http://") ||
          cleanPart.startsWith("https://");
        if (isEndpoint && cleanPart.length > 2) {
          return (
            <span
              key={index}
              className="font-mono bg-primary/[0.04] text-primary border border-primary/10 rounded px-1.5 py-0.5 text-[11px]"
            >
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

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

export function DiagnosticConsole({
  user,
  selectedLab,
  selectedSubmission,
  onSelectSubmission,
  resubmissions,
  loadingResubmissions,
  onResubmissionSaved,
}: DiagnosticConsoleProps) {
  const [resubmissionDialogOpen, setResubmissionDialogOpen] = useState(false);
  const [driveLink, setDriveLink] = useState("");
  const [resubmitNote, setResubmitNote] = useState("");
  const [savingResubmission, setSavingResubmission] = useState(false);

  const getSelectedResubmission = () => {
    return resubmissions.find((request) => request.lab_id === selectedLab.id) || null;
  };

  const request = getSelectedResubmission();
  const hasSubmission = Boolean(selectedSubmission);
  const requestKind: SubmissionRequestKind = hasSubmission ? "resubmit" : "late_first";
  const requestTitle =
    requestKind === "late_first" ? "Late First Submission" : "Resubmission Request";
  const requestDescription =
    requestKind === "late_first"
      ? "Submit a Google Drive link for this lab so admins can approve a late first grading run."
      : "Submit a Google Drive link for the selected lab. You can submit again after admin review.";
  const dialogTitle = request
    ? requestKind === "late_first"
      ? "Update Late Submission Request"
      : "Update Resubmission Request"
    : requestKind === "late_first"
      ? "Request Late First Submission"
      : "Submit Resubmission Request";

  const openRequestDialog = () => {
    setDriveLink(request?.drive_link || "");
    setResubmitNote(request?.note || "");
    setResubmissionDialogOpen(true);
  };

  const isPending = request?.status === "pending";
  const isApproved = request?.status === "approved";
  const isCompleted = request?.status === "completed";
  const canSubmit = driveLink.trim().length > 0 && !isApproved && !savingResubmission;

  const requestStatusText = loadingResubmissions
    ? "Loading request status..."
    : request
      ? `Last updated: ${formatDate(request.updated_at)}`
      : "No resubmission request for this lab yet.";

  const handleSaveResubmission = async () => {
    setSavingResubmission(true);
    try {
      const json = await createResubmissionAction({
        labId: selectedLab.id,
        driveLink,
        note: resubmitNote,
      });

      if (!json.success) {
        toast.error(json.error || "Unable to submit the resubmission request.");
        return;
      }

      onResubmissionSaved(json.data);
      toast.success(
        requestKind === "late_first"
          ? "Late submission request sent. Admins will receive a Discord notification."
          : "Resubmission request sent. Admins will receive a Discord notification."
      );
      setResubmissionDialogOpen(false);
    } catch (err) {
      console.error("Failed to save resubmission request:", err);
      toast.error("Unable to reach the server.");
    } finally {
      setSavingResubmission(false);
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

  return (
    <Card className="border-border bg-card shadow-sm h-full flex flex-col">
      <CardContent className="min-w-0 flex-1 p-3 sm:p-6 space-y-6">
        {/* Submission Information Panel */}
        {selectedSubmission ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-6">
            <div className="min-w-0 space-y-1">
              <h3 className="break-words text-xl font-extrabold font-sans text-foreground tracking-tight sm:text-2xl">
                {user.studentId || "Student ID"}
              </h3>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                <span>
                  Status:{" "}
                  <span className="font-semibold text-foreground">{selectedSubmission.status}</span>
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
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6">
            <div className="max-w-2xl space-y-2">
              <Badge variant="outline">Not Submitted</Badge>
              <h3 className="break-words text-xl font-extrabold font-sans text-foreground tracking-tight">
                {selectedLab.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                No graded result exists for this lab yet. If you missed the first grading run,
                submit a Drive link below for admin approval.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Resubmission Request Section */}
          <div className="motion-panel rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">{requestTitle}</h3>
                  {request ? (
                    <Badge
                      className={
                        request.status === "pending"
                          ? "border-none bg-amber-500 text-white hover:bg-amber-600"
                          : request.status === "approved"
                            ? "border-none bg-emerald-500 text-white hover:bg-emerald-600"
                            : request.status === "completed"
                              ? "border-none bg-sky-600 text-white hover:bg-sky-700"
                              : "border-none bg-red-600 text-white hover:bg-red-700"
                      }
                    >
                      {request.status === "pending"
                        ? "Pending"
                        : request.status === "approved"
                          ? "Approved"
                          : request.status === "completed"
                            ? "Completed"
                            : "Rejected"}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{requestDescription}</p>
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  {requestStatusText}
                </p>
                {request?.admin_note ? (
                  <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-200">
                    Admin note: {request.admin_note}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {request?.drive_link ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={request.drive_link} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Open Link
                    </a>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  onClick={openRequestDialog}
                  disabled={isApproved}
                  variant={isCompleted ? "outline" : "default"}
                >
                  {isApproved
                    ? "Approved"
                    : isPending
                      ? "Update Request"
                      : request
                        ? "Submit Again"
                        : requestKind === "late_first"
                          ? "Request Grading"
                          : "Submit Request"}
                </Button>
              </div>
            </div>

            <Dialog open={resubmissionDialogOpen} onOpenChange={setResubmissionDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{dialogTitle}</DialogTitle>
                  <DialogDescription>
                    Submit a Google Drive link for {selectedLab.title}. Admins will review the
                    request from the control console.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3">
                  <div className="flex gap-3 rounded-lg border border-primary/25 bg-primary/[0.04] p-3.5 text-sm leading-relaxed text-foreground ring-1 ring-primary/10">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <TriangleAlert className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-primary">Submission file requirement</p>
                      <p className="mt-0.5 text-muted-foreground">
                        Compress your submission file and name it as{" "}
                        <span className="rounded bg-background px-1.5 py-0.5 font-mono font-bold text-foreground ring-1 ring-border">
                          Labx_MSSV
                        </span>
                        , for example{" "}
                        <span className="rounded bg-background px-1.5 py-0.5 font-mono font-bold text-foreground ring-1 ring-border">
                          Lab2_SE180123
                        </span>
                        .
                      </p>
                    </div>
                  </div>
                  <Input
                    value={driveLink}
                    onChange={(event) => setDriveLink(event.target.value)}
                    placeholder="https://drive.google.com/..."
                    disabled={isApproved}
                    aria-label="Google Drive resubmission link"
                  />
                  <Textarea
                    value={resubmitNote}
                    onChange={(event) => setResubmitNote(event.target.value)}
                    placeholder="Optional note for admin"
                    disabled={isApproved}
                    className="min-h-[96px]"
                    aria-label="Resubmission note"
                  />
                  <p className="text-xs text-muted-foreground">{requestStatusText}</p>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setResubmissionDialogOpen(false)}
                    disabled={savingResubmission}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveResubmission} disabled={!canSubmit}>
                    {savingResubmission ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {isPending
                      ? "Update Link"
                      : request
                        ? "Submit Again"
                        : requestKind === "late_first"
                          ? "Request Grading"
                          : "Submit Request"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Build logs block */}
          {selectedSubmission?.buildLogs && (
            <div className="space-y-2">
              {(() => {
                const isErrorBuild =
                  (selectedSubmission.buildLogs.toLowerCase().includes("error") ||
                    selectedSubmission.buildLogs.toLowerCase().includes("failed") ||
                    selectedSubmission.buildLogs.toLowerCase().includes("exception")) &&
                  !selectedSubmission.buildLogs.includes("No error logs found") &&
                  !selectedSubmission.buildLogs.includes("Build succeeded");

                return isErrorBuild ? (
                  <>
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                      <TriangleAlert className="h-4 w-4" /> Build Diagnostic Logs
                    </h4>
                    <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-950/30 dark:bg-red-950/10">
                      <pre className="overflow-x-auto font-mono text-xs text-red-800 dark:text-red-300 leading-relaxed whitespace-pre-wrap">
                        {selectedSubmission.buildLogs}
                      </pre>
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Build Diagnostic Logs
                    </h4>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-950/30 dark:bg-emerald-950/10">
                      <pre className="overflow-x-auto font-mono text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed whitespace-pre-wrap">
                        {selectedSubmission.buildLogs}
                      </pre>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Testcases list Table */}
          {selectedSubmission ? (
            <div className="border border-border rounded-lg overflow-hidden overflow-x-auto bg-card w-full">
              <Table className="max-lg:min-w-[680px]">
                <TableHeader className="bg-muted/50 border-b">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[100px] text-xs font-bold uppercase text-muted-foreground">
                      Method
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                      URL / Rule
                    </TableHead>
                    <TableHead className="w-[80px] text-xs font-bold uppercase text-muted-foreground">
                      Pass
                    </TableHead>
                    <TableHead className="w-[100px] text-xs font-bold uppercase text-muted-foreground">
                      Awarded
                    </TableHead>
                    <TableHead className="w-[80px] text-xs font-bold uppercase text-muted-foreground">
                      HTTP
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedTestcases(selectedSubmission).map((tc, idx) => {
                    const { method, rule } = parseTestcase(tc.name);
                    const isPassed = tc.status === "pass";
                    const awarded = tc.score !== undefined ? tc.score : isPassed ? 1 : 0;
                    const httpCode =
                      tc.actualStatusCode !== undefined && tc.actualStatusCode !== null
                        ? tc.actualStatusCode
                        : method === "SOURCE"
                          ? "-"
                          : "200";

                    return (
                      <TableRow
                        key={idx}
                        className="hover:bg-muted/5 border-b border-border/40 transition-colors"
                      >
                        <TableCell className="py-3">{getMethodBadge(method)}</TableCell>
                        <TableCell
                          className="py-3 text-xs text-foreground max-w-[180px] sm:max-w-[350px] truncate"
                          title={rule}
                        >
                          {renderHighlightedRule(rule)}
                        </TableCell>
                        <TableCell className="py-3">
                          {isPassed ? (
                            <span className="text-emerald-500 font-bold text-base">✓</span>
                          ) : (
                            <span className="text-red-500 font-bold text-base">X</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 font-semibold text-xs text-foreground">
                          {awarded.toFixed(1)}
                        </TableCell>
                        <TableCell className="py-3 font-medium text-xs text-muted-foreground">
                          {httpCode}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {/* Response details Section */}
          {selectedSubmission ? (
            <div className="mt-8 min-w-0 space-y-4">
              <h3 className="text-base font-bold font-sans tracking-tight text-foreground border-b pb-2">
                Response details
              </h3>
              <div className="min-w-0 space-y-4">
                {getSortedTestcases(selectedSubmission).map((tc, idx) => {
                  const { method, rule } = parseTestcase(tc.name);
                  return (
                    <div key={idx} className="min-w-0 space-y-1.5">
                      {/* Header: Method Rule */}
                      <div className="break-words text-xs font-bold text-muted-foreground font-mono [overflow-wrap:anywhere] flex items-center gap-1.5">
                        {getMethodBadge(method)}
                        {renderHighlightedRule(rule)}
                      </div>

                      {/* Preformatted box for Response */}
                      {tc.actualResponse ? (
                        <div className="w-full min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8f9fa]">
                          <pre className="max-w-full overflow-x-auto p-3.5 text-[13px] font-mono leading-relaxed text-slate-800 whitespace-pre sm:text-sm lg:overflow-visible lg:text-xs lg:whitespace-pre-wrap lg:break-all">
                            {formatResponse(tc.actualResponse)}
                          </pre>
                        </div>
                      ) : (
                        <div className="text-xs italic text-muted-foreground/60 pl-3">
                          No response details available
                        </div>
                      )}

                      {/* Red error message if failed */}
                      {tc.status === "fail" && tc.message && (
                        <p className="mt-1 break-words pl-1 text-xs font-semibold text-red-500 font-sans [overflow-wrap:anywhere]">
                          {tc.message}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
