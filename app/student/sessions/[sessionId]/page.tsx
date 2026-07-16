"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileJson,
  FolderOpen,
  Layers,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { studentSessionQueryOptions } from "@/lib/queries/student";
import type { SessionSubmission, SubmissionTestcase } from "@/lib/types/erd";

function formatDate(value: string | null) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusBadge(status: SessionSubmission["status"]) {
  if (status === "passed")
    return <Badge className="border-none bg-emerald-500 text-white">Passed</Badge>;
  if (status === "failed")
    return <Badge className="border-none bg-red-600 text-white">Failed</Badge>;
  return <Badge className="border-none bg-amber-500 text-white">Grading</Badge>;
}

function itemTypeBadge(itemType: SessionSubmission["item_type"]) {
  if (itemType === "original") return null;
  return (
    <Badge variant="outline" className="text-[10px] font-bold uppercase">
      {itemType}
    </Badge>
  );
}

function testsFor(submission: SessionSubmission | null): SubmissionTestcase[] {
  return submission?.details?.tests ?? submission?.details?.results ?? [];
}

function responseFor(test: SubmissionTestcase) {
  const response = test.actualResponse ?? test.actual_response;
  if (response === null || response === undefined) return null;
  try {
    return JSON.stringify(JSON.parse(response), null, 2);
  } catch {
    return response;
  }
}

function methodBadgeClass(method?: string) {
  switch (method?.toUpperCase()) {
    case "GET":
      return "bg-[#61aff6] text-white";
    case "POST":
      return "bg-[#49cc90] text-white";
    case "PUT":
      return "bg-[#fca130] text-white";
    case "DELETE":
      return "bg-[#f93e3e] text-white";
    case "PATCH":
      return "bg-[#50e3c2] text-white";
    case "SOURCE":
      return "bg-[#9012fe] text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statusCodeClass(statusCode?: number | null) {
  if (!statusCode) return "border-border/50 bg-muted text-muted-foreground";
  if (statusCode < 300)
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (statusCode < 400)
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300";
  if (statusCode < 500)
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300";
}

export default function StudentSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data, isPending, error } = useQuery(studentSessionQueryOptions(params.sessionId));
  const attempts = useMemo(() => data?.attempts ?? [], [data?.attempts]);
  const session = data?.sessionAccess ?? null;
  const requestedSubmissionId = searchParams.get("submissionId");
  const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (error) toast.error("Unable to load this grading session.");
  }, [error]);

  const effectiveSelectedId = useMemo(() => {
    if (requestedSubmissionId && attempts.some((attempt) => attempt.id === requestedSubmissionId)) {
      return requestedSubmissionId;
    }
    return attempts.at(-1)?.id ?? null;
  }, [attempts, requestedSubmissionId]);

  const selected = useMemo(
    () => attempts.find((attempt) => attempt.id === effectiveSelectedId) ?? null,
    [attempts, effectiveSelectedId]
  );
  const tests = testsFor(selected);
  const logs =
    selected?.details?.build_logs ?? selected?.details?.buildLogs ?? selected?.details?.log;
  const buildFailed = Boolean(
    logs && /error|failed|exception/i.test(logs) && !logs.includes("Build succeeded")
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

  const toggleTest = (index: number) => {
    setExpandedTests((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="h-9 w-9 text-destructive" />
        <div>
          <h1 className="text-lg font-bold">Session unavailable</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This session does not exist or does not belong to your class.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/student/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to sessions
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button
              size="sm"
              variant="ghost"
              className="px-2 sm:px-3"
              onClick={() => router.push("/student/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Button>
            <div className="hidden h-4 w-px shrink-0 bg-border md:block" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-bold text-foreground">
                  {session.session_name}
                </h1>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {session.lab_code}
                </Badge>
              </div>
              <p className="truncate text-[10px] text-muted-foreground">
                {session.session_status === "open" ? "Submission window open" : "Session closed"}
                {session.deadline ? ` · ${formatDate(session.deadline)}` : " · No deadline"}
              </p>
            </div>
          </div>
          {session.drive_root_url ? (
            <Button variant="outline" size="sm" asChild>
              <a href={session.drive_root_url} target="_blank" rel="noreferrer">
                <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Drive
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {attempts.length === 0 ? (
          <Card className="mx-auto flex max-w-2xl flex-col items-center gap-3 border-dashed p-12 text-center">
            <Layers className="h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-bold">No submissions found</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {session.session_status === "open"
                ? "Submit your code in this session's Drive folder. The result will appear after the grader processes it."
                : "This grading session closed without a recorded submission."}
            </p>
            {session.drive_root_url ? (
              <Button size="sm" variant="outline" asChild>
                <a href={session.drive_root_url} target="_blank" rel="noreferrer">
                  <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Open Drive folder
                  <ExternalLink className="ml-1.5 h-3 w-3" />
                </a>
              </Button>
            ) : null}
          </Card>
        ) : (
          <div className="min-w-0 space-y-6">
            {session.drive_root_url ? (
              <Card className="flex flex-col gap-3 border-border p-4 shadow-none sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    <p className="text-sm font-bold">Session Drive folder</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {session.session_status === "open"
                      ? "This submission window is open. Use the Drive folder assigned to this session."
                      : "This session is closed and no longer accepts new grading attempts."}
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a href={session.drive_root_url} target="_blank" rel="noreferrer">
                    Open Drive <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
              </Card>
            ) : null}

            {selected ? (
              <>
                <Card className="flex flex-wrap items-center justify-between gap-4 border-border/80 p-4 shadow-none">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-bold">Attempt #{selected.attempt_no}</span>
                    {statusBadge(selected.status)}
                    {itemTypeBadge(selected.item_type)}
                    <span className="hidden h-4 w-px bg-border sm:inline" />
                    <span className="text-sm text-muted-foreground">
                      Score:{" "}
                      <strong className="font-mono text-foreground">
                        {selected.score === null ? "—" : selected.score.toFixed(2)} / 10
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(selected.graded_at ?? selected.submitted_at)}
                    </span>
                    {selected.source_url ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={selected.source_url} target="_blank" rel="noreferrer">
                          Source <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </Card>

                {logs ? (
                  <section className="space-y-2">
                    <h2
                      className={`flex items-center gap-1.5 text-xs font-bold ${
                        buildFailed
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {buildFailed ? (
                        <TriangleAlert className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Build diagnostic logs
                    </h2>
                    <div
                      className={`rounded-lg border p-4 ${
                        buildFailed
                          ? "border-red-200 bg-red-50/50 dark:border-red-950/30 dark:bg-red-950/10"
                          : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-950/30 dark:bg-emerald-950/10"
                      }`}
                    >
                      <pre className="max-h-60 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
                        {logs}
                      </pre>
                    </div>
                  </section>
                ) : null}

                <section className="space-y-2">
                  <h2 className="text-xs font-bold">
                    Testcase results ({tests.filter((test) => test.passed).length}/{tests.length})
                  </h2>
                  {tests.length === 0 ? (
                    <Card className="p-6 text-center text-sm text-muted-foreground">
                      No testcase results found in this attempt.
                    </Card>
                  ) : (
                    <TestcaseTable
                      tests={tests}
                      hasApiDetails={hasApiDetails}
                      expandedTests={expandedTests}
                      onToggle={toggleTest}
                    />
                  )}
                </section>
              </>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

function TestcaseTable({
  tests,
  hasApiDetails,
  expandedTests,
  onToggle,
}: {
  tests: SubmissionTestcase[];
  hasApiDetails: boolean;
  expandedTests: Set<number>;
  onToggle: (index: number) => void;
}) {
  const columnCount = hasApiDetails ? 6 : 4;

  return (
    <Card className="overflow-hidden rounded-lg border-border shadow-none">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              {hasApiDetails ? <TableHead className="w-[100px]">Method</TableHead> : null}
              <TableHead className="min-w-[220px]">
                {hasApiDetails ? "Endpoint / Check" : "Testcase"}
              </TableHead>
              {hasApiDetails ? (
                <TableHead className="w-[120px] text-center">Status code</TableHead>
              ) : null}
              <TableHead className="w-[120px] text-center">Result</TableHead>
              <TableHead className="w-[120px] text-right">Score</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tests.map((test, index) => {
              const method = test.httpMethod ?? test.method;
              const label = test.urlTemplate ?? test.url ?? test.name ?? `Test ${index + 1}`;
              const statusCode =
                test.actualStatusCode ?? test.statusCode ?? test.actual_status_code;
              const errorMessage = test.errorMessage ?? test.error;
              const response = responseFor(test);
              const detailAvailable = Boolean(errorMessage || response || test.overrideReason);
              const expanded = expandedTests.has(index);
              const hasOverride =
                test.manualOverrideScore !== null && test.manualOverrideScore !== undefined;
              const score = hasOverride
                ? test.manualOverrideScore!
                : (test.effectiveScore ?? test.awardedScore ?? test.score ?? 0);

              return (
                <Fragment key={`${label}-${index}`}>
                  <TableRow
                    className={detailAvailable ? "cursor-pointer" : undefined}
                    onClick={() => detailAvailable && onToggle(index)}
                  >
                    {hasApiDetails ? (
                      <TableCell>
                        {method ? (
                          <span
                            className={`inline-flex w-[66px] items-center justify-center rounded-[3px] py-0.5 font-mono text-[10px] font-bold uppercase ${methodBadgeClass(method)}`}
                          >
                            {method}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    ) : null}
                    <TableCell className="break-all font-mono text-xs font-medium">
                      {label}
                    </TableCell>
                    {hasApiDetails ? (
                      <TableCell className="text-center">
                        {statusCode !== null && statusCode !== undefined ? (
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${statusCodeClass(statusCode)}`}
                          >
                            {statusCode}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-center">
                      {test.passed ? (
                        <Badge className="border-none bg-emerald-500 text-white">✓ Pass</Badge>
                      ) : (
                        <Badge variant="destructive">✗ Fail</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold">
                      {hasOverride ? (
                        <span title="Teacher overridden">
                          <span className="mr-1 text-[10px] text-muted-foreground line-through">
                            {(test.awardedScore ?? test.score ?? 0).toFixed(1)}
                          </span>
                          <span className="text-amber-600 dark:text-amber-400">
                            {score.toFixed(1)}
                          </span>
                        </span>
                      ) : (
                        score.toFixed(1)
                      )}
                    </TableCell>
                    <TableCell>
                      {detailAvailable ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggle(index);
                          }}
                        >
                          {expanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          <span className="sr-only">Toggle testcase details</span>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableCell colSpan={columnCount} className="px-6 py-3">
                        <div className="space-y-3">
                          {errorMessage ? (
                            <div className="rounded-lg border border-red-200 bg-red-500/5 p-3 text-xs text-red-700 dark:border-red-950/30 dark:text-red-300">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <div>
                                  <p className="mb-0.5 font-bold">Error message</p>
                                  <pre className="whitespace-pre-wrap font-mono text-[11px]">
                                    {errorMessage}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          ) : null}
                          {test.overrideReason ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-500/5 p-3 text-xs text-amber-700 dark:border-amber-950/30 dark:text-amber-300">
                              <strong>Teacher override:</strong> {test.overrideReason}
                            </div>
                          ) : null}
                          {response ? (
                            <div className="space-y-1">
                              <p className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                                <FileJson className="h-3.5 w-3.5" /> Actual response / output
                              </p>
                              <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-card p-3 font-mono text-[11px] leading-relaxed">
                                {response}
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
  );
}
