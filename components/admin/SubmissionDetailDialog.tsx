"use client";

import { Fragment, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileCode2,
  FileJson,
  Pencil,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  GradingSessionStudentResult,
  SessionSubmission,
  SubmissionStatus,
  SubmissionTestcase,
} from "@/lib/types/erd";
import { cn } from "@/lib/utils";

type SubmissionDetailDialogProps = {
  student: GradingSessionStudentResult | null;
  attempts: SessionSubmission[];
  loading: boolean;
  onClose: () => void;
  onEdit: (attempt: SessionSubmission) => void;
  onDelete: (attempt: SessionSubmission) => void;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}

function statusBadge(status: SubmissionStatus) {
  if (status === "passed")
    return <Badge className="border-0 bg-emerald-500/10 text-emerald-700">Passed</Badge>;
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  return <Badge className="border-0 bg-amber-500/10 text-amber-700">Grading</Badge>;
}

function itemTypeBadge(itemType: SessionSubmission["item_type"]) {
  return (
    <Badge variant="outline" className="font-mono text-[10px] capitalize">
      {itemType}
    </Badge>
  );
}

function testsFor(submission: SessionSubmission): SubmissionTestcase[] {
  return submission.details?.results ?? submission.details?.tests ?? [];
}

function formatResponse(value: unknown) {
  if (typeof value !== "string") return JSON.stringify(value, null, 2);
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function methodClass(method: string) {
  if (method === "GET") return "bg-[#61aff6] text-white";
  if (method === "POST") return "bg-[#49cc90] text-white";
  if (method === "PUT") return "bg-[#fca130] text-white";
  if (method === "DELETE") return "bg-[#f93e3e] text-white";
  if (method === "PATCH") return "bg-[#50e3c2] text-white";
  return "bg-muted text-muted-foreground";
}

function statusCodeClass(code: number) {
  if (code >= 200 && code < 300) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (code >= 400 && code < 500) return "border-amber-200 bg-amber-50 text-amber-700";
  if (code >= 500) return "border-red-200 bg-red-50 text-red-700";
  return "border-border bg-muted text-foreground";
}

export function SubmissionDetailDialog({
  student,
  attempts,
  loading,
  onClose,
  onEdit,
  onDelete,
}: SubmissionDetailDialogProps) {
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [expandedTests, setExpandedTests] = useState<Record<number, boolean>>({});
  const selectedAttempt = useMemo(
    () => attempts.find((attempt) => attempt.id === selectedAttemptId) ?? attempts[0] ?? null,
    [attempts, selectedAttemptId]
  );
  const tests = selectedAttempt ? testsFor(selectedAttempt) : [];
  const buildLogs =
    selectedAttempt?.details?.build_logs ??
    selectedAttempt?.details?.buildLogs ??
    selectedAttempt?.details?.log;
  const buildFailed = Boolean(
    buildLogs && /error|failed|exception/i.test(buildLogs) && !buildLogs.includes("Build succeeded")
  );
  const hasApiDetails = tests.some(
    (test) =>
      test.httpMethod ||
      test.method ||
      test.urlTemplate ||
      test.url ||
      test.actualStatusCode !== undefined ||
      test.statusCode !== undefined
  );

  const selectAttempt = (attemptId: string) => {
    setSelectedAttemptId(attemptId);
    setExpandedTests({});
  };

  return (
    <Dialog open={Boolean(student)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] w-[70vw] max-w-[95vw] flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border bg-card px-6 py-4">
          <DialogTitle className="text-xl">Result Details: {student?.student_code}</DialogTitle>
          <DialogDescription>
            Full Name: <strong className="text-foreground">{student?.student_name || "—"}</strong>
            {" · "}Email: <strong className="text-foreground">{student?.student_email}</strong>
          </DialogDescription>
          <div className="pt-3">
            <span className="inline-flex border-b-2 border-primary pb-2 text-sm font-semibold text-primary">
              Attempts ({attempts.length})
            </span>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" /> Loading details...
            </div>
          ) : attempts.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <FileCode2 className="h-8 w-8" /> This student has not submitted this session yet.
            </div>
          ) : (
            <div className="space-y-6">
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider">All Attempts</h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table className="min-w-[720px]">
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Attempt</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attempts.map((attempt) => {
                        const selected = attempt.id === selectedAttempt?.id;
                        return (
                          <TableRow
                            key={attempt.id}
                            className={cn(
                              "cursor-pointer text-xs",
                              selected && "bg-primary/5 font-semibold"
                            )}
                            onClick={() => selectAttempt(attempt.id)}
                          >
                            <TableCell className="font-bold">#{attempt.attempt_no}</TableCell>
                            <TableCell>{itemTypeBadge(attempt.item_type)}</TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {attempt.score === null ? "—" : attempt.score.toFixed(2)}
                            </TableCell>
                            <TableCell>{statusBadge(attempt.status)}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(attempt.submitted_at)}
                            </TableCell>
                            <TableCell onClick={(event) => event.stopPropagation()}>
                              <div className="flex justify-end gap-1">
                                {attempt.source_url ? (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                    <a
                                      href={attempt.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      aria-label="Open source"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  </Button>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => onEdit(attempt)}
                                  aria-label="Edit attempt"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => onDelete(attempt)}
                                  aria-label="Delete attempt"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </section>

              {selectedAttempt ? (
                <section className="space-y-5 border-t border-border pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Diagnostic details:
                      Attempt #{selectedAttempt.attempt_no}
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      Graded at: {formatDate(selectedAttempt.graded_at)}
                    </span>
                  </div>

                  {buildLogs ? (
                    <div className="space-y-2">
                      <h4
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-bold",
                          buildFailed ? "text-red-700" : "text-emerald-700"
                        )}
                      >
                        {buildFailed ? (
                          <TriangleAlert className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}{" "}
                        Build Diagnostic Logs
                      </h4>
                      <pre
                        className={cn(
                          "max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border p-4 font-mono text-xs",
                          buildFailed
                            ? "border-red-200 bg-red-50/50"
                            : "border-emerald-200 bg-emerald-50/50"
                        )}
                      >
                        {buildLogs}
                      </pre>
                    </div>
                  ) : null}

                  {tests.length ? (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold">
                        Testcase Results ({tests.filter((test) => test.passed).length}/
                        {tests.length})
                      </h4>
                      <Card className="overflow-hidden shadow-none">
                        <div className="overflow-x-auto">
                          <Table className="min-w-[680px]">
                            <TableHeader className="bg-muted/30">
                              <TableRow>
                                {hasApiDetails ? (
                                  <TableHead className="w-24">Method</TableHead>
                                ) : null}
                                <TableHead>Endpoint / Check</TableHead>
                                {hasApiDetails ? (
                                  <TableHead className="text-center">Status</TableHead>
                                ) : null}
                                <TableHead className="text-center">Result</TableHead>
                                <TableHead className="text-right">Score</TableHead>
                                <TableHead className="w-12" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tests.map((test, index) => {
                                const method = (test.httpMethod ?? test.method ?? "").toUpperCase();
                                const endpoint =
                                  test.urlTemplate ?? test.url ?? test.name ?? `Test ${index + 1}`;
                                const statusCode =
                                  test.actualStatusCode ??
                                  test.statusCode ??
                                  test.actual_status_code;
                                const response = test.actualResponse ?? test.actual_response;
                                const errorMessage = test.errorMessage ?? test.error;
                                const score =
                                  test.manualOverrideScore ??
                                  test.effectiveScore ??
                                  test.awardedScore ??
                                  test.score;
                                const expandable = Boolean(
                                  errorMessage || response || test.overrideReason
                                );
                                const expanded = Boolean(expandedTests[index]);
                                return (
                                  <Fragment key={`${endpoint}-${index}`}>
                                    <TableRow
                                      className={expandable ? "cursor-pointer" : ""}
                                      onClick={() =>
                                        expandable &&
                                        setExpandedTests((current) => ({
                                          ...current,
                                          [index]: !current[index],
                                        }))
                                      }
                                    >
                                      {hasApiDetails ? (
                                        <TableCell>
                                          {method ? (
                                            <span
                                              className={cn(
                                                "inline-flex w-16 justify-center rounded px-1 py-0.5 font-mono text-[10px] font-bold",
                                                methodClass(method)
                                              )}
                                            >
                                              {method}
                                            </span>
                                          ) : (
                                            "—"
                                          )}
                                        </TableCell>
                                      ) : null}
                                      <TableCell className="break-all font-mono text-xs">
                                        {endpoint}
                                      </TableCell>
                                      {hasApiDetails ? (
                                        <TableCell className="text-center">
                                          {statusCode !== null && statusCode !== undefined ? (
                                            <span
                                              className={cn(
                                                "rounded-full border px-2 py-0.5 font-mono text-[11px]",
                                                statusCodeClass(statusCode)
                                              )}
                                            >
                                              {statusCode}
                                            </span>
                                          ) : (
                                            "—"
                                          )}
                                        </TableCell>
                                      ) : null}
                                      <TableCell className="text-center">
                                        <Badge
                                          variant={test.passed ? "outline" : "destructive"}
                                          className={test.passed ? "text-emerald-700" : ""}
                                        >
                                          {test.passed ? "✓ Pass" : "✗ Fail"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-xs font-bold">
                                        {score === null || score === undefined
                                          ? test.passed
                                            ? "1.0"
                                            : "0.0"
                                          : score.toFixed(1)}
                                      </TableCell>
                                      <TableCell>
                                        {expandable ? (
                                          expanded ? (
                                            <ChevronUp className="h-4 w-4" />
                                          ) : (
                                            <ChevronDown className="h-4 w-4" />
                                          )
                                        ) : null}
                                      </TableCell>
                                    </TableRow>
                                    {expanded ? (
                                      <TableRow className="bg-muted/10">
                                        <TableCell colSpan={hasApiDetails ? 6 : 4}>
                                          <div className="space-y-3 py-2">
                                            {errorMessage ? (
                                              <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-xs text-red-700">
                                                <p className="mb-1 flex items-center gap-1 font-bold">
                                                  <AlertCircle className="h-4 w-4" /> Error Message
                                                </p>
                                                <pre className="whitespace-pre-wrap font-mono text-[11px]">
                                                  {errorMessage}
                                                </pre>
                                              </div>
                                            ) : null}
                                            {test.overrideReason ? (
                                              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-800">
                                                <strong>Override Reason:</strong>{" "}
                                                {test.overrideReason}
                                              </div>
                                            ) : null}
                                            {response !== null && response !== undefined ? (
                                              <div>
                                                <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                                                  <FileJson className="h-3.5 w-3.5" /> Actual
                                                  Response / Output
                                                </p>
                                                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border bg-background p-3 font-mono text-[11px]">
                                                  {formatResponse(response)}
                                                </pre>
                                              </div>
                                            ) : null}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ) : null}
                                  </Fragment>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </Card>
                    </div>
                  ) : !buildLogs ? (
                    <div className="border-y border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                      No testcase details available.
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-muted/10 px-6 py-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
