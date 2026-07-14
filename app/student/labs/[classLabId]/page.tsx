"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { UserPayload } from "@/lib/utils/auth";
import {
  ArrowLeft,
  TriangleAlert,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileJson,
  Calendar,
  FileUp,
  Layers,
  ExternalLink,
  FolderOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { createResubmissionRequestAction } from "@/lib/actions/erd-student";
import { studentClassLabQueryOptions, studentQueryKeys } from "@/lib/queries/student";

function statusBadge(status: string) {
  if (status === "passed")
    return (
      <Badge className="border-none bg-emerald-500 text-white font-medium text-xs px-2.5 py-0.5">
        Passed
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge className="border-none bg-red-600 text-white font-medium text-xs px-2.5 py-0.5">
        Failed
      </Badge>
    );
  return (
    <Badge className="border-none bg-amber-500 text-white font-medium text-xs px-2.5 py-0.5">
      Grading
    </Badge>
  );
}

function itemTypeBadge(itemType: string) {
  if (itemType === "resubmit")
    return (
      <Badge variant="outline" className="text-[10px] font-bold uppercase">
        Resubmit
      </Badge>
    );
  if (itemType === "late")
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-bold uppercase border-amber-300 text-amber-600 bg-amber-500/5"
      >
        Late
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-bold uppercase border-muted-foreground/30 text-muted-foreground"
    >
      Original
    </Badge>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

function formatResponse(response: string) {
  try {
    return JSON.stringify(JSON.parse(response), null, 2);
  } catch {
    return response;
  }
}

function getMethodBadgeColor(method?: string) {
  switch (method?.toUpperCase()) {
    case "GET":
      return "bg-[#61aff6] text-white dark:bg-[#489bed]";
    case "POST":
      return "bg-[#49cc90] text-white dark:bg-[#3dbb7f]";
    case "PUT":
      return "bg-[#fca130] text-white dark:bg-[#e58e26]";
    case "DELETE":
      return "bg-[#f93e3e] text-white dark:bg-[#e52d2d]";
    case "PATCH":
      return "bg-[#50e3c2] text-white dark:bg-[#3cd1b0]";
    case "SOURCE":
      return "bg-[#9012fe] text-white dark:bg-[#7a0ce3]";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getStatusCodeBadgeColor(statusCode?: number | null) {
  if (!statusCode) return "bg-muted text-muted-foreground border-border/50";
  if (statusCode >= 200 && statusCode < 300) {
    return "bg-emerald-50 text-emerald-600 border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
  }
  if (statusCode >= 300 && statusCode < 400) {
    return "bg-blue-50 text-blue-600 border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
  }
  if (statusCode >= 400 && statusCode < 500) {
    return "bg-rose-50 text-rose-600 border-rose-200/80 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
  }
  return "bg-amber-50 text-amber-600 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
}

export default function ClassLabAttemptsPage() {
  const params = useParams<{ classLabId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const urlSubmissionId = searchParams.get("submissionId");

  const [user, setUser] = useState<UserPayload | null>(null);
  const {
    data: classLabData,
    dataUpdatedAt,
    error: classLabError,
    isPending: loading,
  } = useQuery(studentClassLabQueryOptions(params.classLabId));
  const attempts = useMemo(() => classLabData?.attempts ?? [], [classLabData?.attempts]);
  const request = classLabData?.request ?? null;
  const labAccess = classLabData?.labAccess ?? null;
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  useEffect(() => {
    const token = Cookies.get("authToken");
    if (token) {
      try {
        const decoded = jwtDecode<UserPayload>(token);
        setTimeout(() => {
          setUser(decoded);
        }, 0);
      } catch (err) {
        console.error("Failed to decode token:", err);
      }
    }
  }, []);
  const [expandedTests, setExpandedTests] = useState<Record<number, boolean>>({});

  const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false);
  const [driveLink, setDriveLink] = useState("");
  const [resubmitNote, setResubmitNote] = useState("");
  const [submittingResubmit, setSubmittingResubmit] = useState(false);

  useEffect(() => {
    if (!classLabError) return;
    console.error("Failed to load attempt history:", classLabError);
    toast.error("Unable to load attempt history.");
  }, [classLabError]);

  // Synchronize URL submissionId or default to latest attempt when attempts change
  useEffect(() => {
    if (attempts.length > 0) {
      if (urlSubmissionId && attempts.some((a) => a.id === urlSubmissionId)) {
        const timer = setTimeout(() => {
          setSelectedAttemptId(urlSubmissionId);
        }, 0);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setSelectedAttemptId(attempts[attempts.length - 1].id);
        }, 0);
        return () => clearTimeout(timer);
      }
    } else {
      const timer = setTimeout(() => {
        setSelectedAttemptId(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [urlSubmissionId, attempts]);

  const handleSelectAttempt = (id: string) => {
    setSelectedAttemptId(id);
    setExpandedTests({});
    router.replace(`/student/labs/${params.classLabId}?submissionId=${id}`, { scroll: false });
  };

  const toggleTestExpanded = (idx: number) => {
    setExpandedTests((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const hasAttempts = attempts.length > 0;
  const deadlineTime = labAccess?.deadline ? new Date(labAccess.deadline).getTime() : null;
  const hasDeadline = deadlineTime !== null && Number.isFinite(deadlineTime);
  const isBeforeDeadline = hasDeadline ? deadlineTime > dataUpdatedAt : false;
  const requestType = hasAttempts ? "resubmit" : "late";
  const canRequestLate = !hasAttempts && (!hasDeadline || !isBeforeDeadline);
  const canOpenRequest = hasAttempts || canRequestLate;
  const requestLabel = hasAttempts ? "Request Resubmit" : "Request Late Submission";

  const handleSaveResubmit = async () => {
    if (!driveLink.trim()) {
      toast.error("Please enter a Google Drive link.");
      return;
    }
    setSubmittingResubmit(true);
    try {
      const result = await createResubmissionRequestAction(
        params.classLabId,
        driveLink,
        resubmitNote,
        requestType
      );
      if (!result.success) {
        toast.error(result.error || "Unable to submit the resubmission request.");
        return;
      }
      toast.success(
        `${requestType === "late" ? "Late submission" : "Resubmission"} request sent. Admins will be notified.`
      );
      setDriveLink("");
      setResubmitNote("");
      setResubmitDialogOpen(false);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: studentQueryKeys.classLab(params.classLabId),
        }),
        queryClient.invalidateQueries({
          queryKey: studentQueryKeys.labOverview(),
        }),
      ]);
    } catch (err) {
      console.error("Failed to save resubmission request:", err);
      toast.error("Unable to reach the server.");
    } finally {
      setSubmittingResubmit(false);
    }
  };

  // Find currently selected attempt
  const selectedAttempt = attempts.find((a) => a.id === selectedAttemptId);

  // Extract test results and build logs from selected attempt details JSON
  const buildLogs = selectedAttempt?.details?.build_logs || selectedAttempt?.details?.buildLogs;
  const tests = selectedAttempt?.details?.results || selectedAttempt?.details?.tests || [];
  const isErrorBuild =
    !!buildLogs &&
    /error|failed|exception/i.test(buildLogs) &&
    !buildLogs.includes("Build succeeded");

  return (
    <div className="min-h-screen bg-muted/20 font-quicksand">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push("/student/dashboard")}
              className="px-2 sm:px-3"
            >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Button>
            <div className="h-4 w-px bg-border shrink-0 hidden md:block" />
            <h1 className="text-sm font-bold text-foreground hidden md:block">
              Lab Attempt details & History
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end leading-tight select-none">
                  <span className="text-xs font-bold text-foreground">{user.name}</span>
                  <span className="text-[10px] text-muted-foreground font-medium font-sans">
                    {user.email} {user.className ? `· ${user.className}` : ""}
                  </span>
                </div>
                {user.picture ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={user.picture}
                      alt={user.name || "User Avatar"}
                      className="h-8 w-8 rounded-full border border-border select-none pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                  </>
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20 select-none">
                    {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
                  </div>
                )}
              </div>
            )}

            {!loading && (
              <Button
                size="sm"
                onClick={() => setResubmitDialogOpen(true)}
                disabled={request?.status === "pending" || !canOpenRequest}
                title={request?.status === "pending" ? "You have a pending request" : requestLabel}
                className="font-bold text-xs"
              >
                <FileUp className="mr-1.5 h-3.5 w-3.5" />
                {requestLabel}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout: Left Content, Right Sidebar */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {loading ? (
          /* Loading Skeleton for whole dashboard */
          <div className="grid gap-6 lg:grid-cols-4">
            {/* Left Content Skeleton */}
            <div className="lg:col-span-3 lg:order-last space-y-6">
              {/* Mobile Carousel Skeleton */}
              <div className="lg:hidden space-y-2">
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Card key={idx} className="p-3 space-y-2 shrink-0 w-[180px] animate-pulse">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3.5 w-1/3" />
                      <Skeleton className="h-3 w-3/4" />
                    </Card>
                  ))}
                </div>
              </div>

              <Card className="p-4 flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-48" />
              </Card>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-32 w-full rounded-lg" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-48 w-full rounded-lg" />
              </div>
            </div>

            {/* Right Sidebar Skeleton (Desktop only) */}
            <div className="hidden lg:block lg:order-first lg:sticky lg:top-[68px] lg:self-start space-y-4 max-h-[calc(100vh-100px)] overflow-y-auto pr-2">
              <Skeleton className="h-5 w-24" />
              {Array.from({ length: 3 }).map((_, idx) => (
                <Card key={idx} className="p-3 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-3/4" />
                </Card>
              ))}
            </div>
          </div>
        ) : attempts.length === 0 ? (
          /* Empty State */
          <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center max-w-2xl mx-auto">
            <Layers className="h-10 w-10 text-muted-foreground" />
            <h3 className="font-bold text-lg text-foreground">No submissions found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {isBeforeDeadline
                ? "Submit your code in the class Drive folder before the deadline. The grader will sync your result after scanning the folder."
                : "The direct submission window is closed. Send a late submission request with your Drive link for admin review."}
            </p>
            {labAccess?.drive_root_url ? (
              <Button size="sm" variant="outline" asChild>
                <a href={labAccess.drive_root_url} target="_blank" rel="noreferrer">
                  <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                  Open Class Drive Folder
                  <ExternalLink className="ml-1.5 h-3 w-3" />
                </a>
              </Button>
            ) : null}
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Button
                size="sm"
                onClick={() => setResubmitDialogOpen(true)}
                disabled={request?.status === "pending" || !canRequestLate}
                title={request?.status === "pending" ? "You have a pending request" : requestLabel}
              >
                <FileUp className="mr-1.5 h-3.5 w-3.5" />
                {request?.status === "pending" ? "Request Pending" : requestLabel}
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push("/student/dashboard")}>
                Back to Dashboard
              </Button>
            </div>
          </Card>
        ) : (
          /* Main Layout when loaded */
          <div className="grid gap-6 lg:grid-cols-4">
            {/* Left Column: selected attempt details */}
            <div className="lg:col-span-3 lg:order-last space-y-6 min-w-0">
              {labAccess?.drive_root_url ? (
                <Card className="flex flex-col gap-3 border-border p-4 shadow-none sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-primary" />
                      <p className="text-sm font-bold text-foreground">Class Drive Folder</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isBeforeDeadline
                        ? "The submission window is open. Keep your file name in the required Labx_MSSV format."
                        : "The deadline has passed. New work should go through a late/resubmit request."}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <a href={labAccess.drive_root_url} target="_blank" rel="noreferrer">
                      Open Drive
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                  </Button>
                </Card>
              ) : null}
              {/* Mobile History Carousel (Hidden on Desktop) */}
              <div className="lg:hidden space-y-2">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider px-1">
                  Submission History ({attempts.length})
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-3 pt-1 -mx-4 px-4 scrollbar-none snap-x snap-mandatory">
                  {attempts
                    .slice()
                    .reverse()
                    .map((attempt) => {
                      const isSelected = attempt.id === selectedAttemptId;
                      const isPassed = attempt.status === "passed";
                      const isFailed = attempt.status === "failed";
                      return (
                        <button
                          key={attempt.id}
                          onClick={() => handleSelectAttempt(attempt.id)}
                          className={`snap-align-start shrink-0 w-[180px] text-left p-3 rounded-lg border transition-all flex flex-col gap-2 ${
                            isSelected
                              ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm"
                              : "border-border bg-card hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold text-foreground">
                              Attempt #{attempt.attempt_no}
                            </span>
                            {attempt.item_type && attempt.item_type !== "original" ? (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                {attempt.item_type}
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between w-full text-xs">
                            <span className="font-semibold text-foreground">
                              Score: {attempt.score !== null ? attempt.score.toFixed(2) : "—"}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  isPassed
                                    ? "bg-emerald-500"
                                    : isFailed
                                      ? "bg-red-600"
                                      : "bg-amber-500 animate-pulse"
                                }`}
                              />
                              <span className="text-[11px] capitalize text-muted-foreground">
                                {attempt.status}
                              </span>
                            </span>
                          </div>

                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatDate(attempt.submitted_at)}
                          </span>
                        </button>
                      );
                    })}
                </div>

                {/* Latest Resubmission Request Card inside Mobile Carousel section */}
                {request ? (
                  <div className="border border-border/80 rounded-lg p-3 bg-muted/30 flex items-center justify-between gap-4 mt-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {request.request_type === "late" ? "Late Request" : "Resubmit Request"}
                        </span>
                        <Badge
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 border-none ${
                            request.status === "pending"
                              ? "bg-amber-500 text-white"
                              : request.status === "approved"
                                ? "bg-emerald-500 text-white"
                                : request.status === "completed"
                                  ? "bg-sky-600 text-white"
                                  : "bg-red-600 text-white"
                          }`}
                        >
                          {request.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Last updated: {formatDate(request.updated_at)}
                      </p>
                      {request.admin_note ? (
                        <div className="text-[10px] text-red-600 dark:text-red-400 font-medium">
                          <span className="font-bold">Feedback:</span> {request.admin_note}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {selectedAttempt ? (
                <>
                  {/* General Info Card */}
                  <Card className="flex flex-wrap items-center justify-between gap-4 p-4 border border-border/80 bg-card">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-bold text-foreground">
                        Attempt #{selectedAttempt.attempt_no}
                      </span>
                      {statusBadge(selectedAttempt.status)}
                      {itemTypeBadge(selectedAttempt.item_type)}
                      <span className="h-4 w-px bg-border hidden sm:inline" />
                      <span className="text-sm text-muted-foreground">
                        Score:{" "}
                        <span className="font-bold text-foreground">
                          {selectedAttempt.score !== null ? selectedAttempt.score.toFixed(2) : "—"}{" "}
                          / 10
                        </span>
                      </span>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(selectedAttempt.submitted_at)}
                    </span>
                  </Card>

                  {/* Build Diagnostic Logs */}
                  {buildLogs ? (
                    <div className="space-y-2">
                      <h4
                        className={`flex items-center gap-1.5 text-xs font-bold ${
                          isErrorBuild
                            ? "text-red-600 dark:text-red-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {isErrorBuild ? (
                          <TriangleAlert className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Build Diagnostic Logs
                      </h4>
                      <div
                        className={`rounded-lg border p-4 ${
                          isErrorBuild
                            ? "border-red-200 bg-red-50/50 dark:border-red-950/30 dark:bg-red-950/10"
                            : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-950/30 dark:bg-emerald-950/10"
                        }`}
                      >
                        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-60 overflow-y-auto">
                          {buildLogs}
                        </pre>
                      </div>
                    </div>
                  ) : null}

                  {/* Testcase Results */}
                  {tests.length > 0 ? (
                    (() => {
                      const hasApiDetails = tests.some(
                        (tc) =>
                          tc.httpMethod ||
                          tc.method ||
                          tc.urlTemplate ||
                          tc.url ||
                          tc.actualStatusCode !== undefined ||
                          tc.statusCode !== undefined
                      );
                      return (
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-foreground">
                            Testcase Results ({tests.filter((t) => t.passed).length}/{tests.length})
                          </h4>
                          <Card className="overflow-hidden border border-border shadow-none rounded-lg bg-card">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader className="bg-muted/30">
                                  <TableRow>
                                    {hasApiDetails ? (
                                      <>
                                        <TableHead className="h-10 text-xs w-[100px] min-w-[80px]">
                                          Method
                                        </TableHead>
                                        <TableHead className="h-10 text-xs min-w-[250px]">
                                          Endpoint / Check
                                        </TableHead>
                                        <TableHead className="h-10 text-xs w-[120px] min-w-[100px] text-center">
                                          Status Code
                                        </TableHead>
                                        <TableHead className="h-10 text-xs w-[120px] min-w-[100px] text-center">
                                          Result
                                        </TableHead>
                                        <TableHead className="h-10 text-xs w-[150px] min-w-[80px] text-right">
                                          Score
                                        </TableHead>
                                        <TableHead className="h-10 text-xs w-[60px]"></TableHead>
                                      </>
                                    ) : (
                                      <>
                                        <TableHead className="h-10 text-xs min-w-[220px]">
                                          Testcase
                                        </TableHead>
                                        <TableHead className="h-10 text-xs w-[120px] min-w-[100px] text-center">
                                          Result
                                        </TableHead>
                                        <TableHead className="h-10 text-xs w-[120px] min-w-[80px] text-right">
                                          Score
                                        </TableHead>
                                        <TableHead className="h-10 text-xs w-[60px]"></TableHead>
                                      </>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {tests.map((tc, idx) => {
                                    const isPassed = tc.passed;
                                    const method = tc.httpMethod || tc.method;
                                    const url = tc.urlTemplate || tc.url || tc.name;
                                    const statusCode =
                                      tc.actualStatusCode ?? tc.statusCode ?? tc.actual_status_code;
                                    const responseVal = tc.actualResponse || tc.actual_response;
                                    const err = tc.errorMessage || tc.error;
                                    const hasOverride =
                                      tc.manualOverrideScore !== null &&
                                      tc.manualOverrideScore !== undefined;

                                    const scoreToDisplay = hasOverride
                                      ? tc.manualOverrideScore
                                      : (tc.effectiveScore ?? tc.awardedScore ?? tc.score);

                                    const hasDetails = !!(err || responseVal || tc.overrideReason);
                                    const isExpanded = !!expandedTests[idx];

                                    return (
                                      <React.Fragment key={idx}>
                                        <TableRow
                                          className={`transition-colors ${
                                            hasDetails
                                              ? "cursor-pointer hover:bg-muted/10"
                                              : "hover:bg-muted/5"
                                          } border-b border-border/50`}
                                          onClick={() => {
                                            if (hasDetails) toggleTestExpanded(idx);
                                          }}
                                        >
                                          {hasApiDetails ? (
                                            <>
                                              <TableCell className="py-3 min-w-[80px]">
                                                {method ? (
                                                  <span
                                                    className={`inline-flex items-center justify-center font-mono font-bold text-[10px] uppercase rounded-[3px] w-[66px] py-0.5 select-none ${getMethodBadgeColor(
                                                      method
                                                    )}`}
                                                  >
                                                    {method}
                                                  </span>
                                                ) : (
                                                  <span className="text-muted-foreground">—</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="py-3 min-w-[250px]">
                                                <div className="font-mono text-xs font-medium text-foreground select-all break-all">
                                                  {url || "—"}
                                                </div>
                                              </TableCell>
                                              <TableCell className="py-3 text-center min-w-[100px]">
                                                {statusCode !== undefined && statusCode !== null ? (
                                                  <span
                                                    className={`inline-flex items-center justify-center font-mono font-semibold text-[11px] px-2.5 py-0.5 rounded-full border select-none ${getStatusCodeBadgeColor(
                                                      statusCode
                                                    )}`}
                                                  >
                                                    {statusCode}
                                                  </span>
                                                ) : (
                                                  <span className="text-muted-foreground">—</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="py-3 text-center min-w-[100px]">
                                                {isPassed ? (
                                                  <Badge className="bg-emerald-500 hover:bg-emerald-500/90 text-white font-medium text-[11px] px-2.5 py-0.5 border-none">
                                                    ✓ Pass
                                                  </Badge>
                                                ) : (
                                                  <Badge
                                                    variant="destructive"
                                                    className="font-medium text-[11px] px-2.5 py-0.5"
                                                  >
                                                    ✗ Fail
                                                  </Badge>
                                                )}
                                              </TableCell>
                                              <TableCell className="py-3 text-right font-mono text-xs min-w-[80px]">
                                                {hasOverride ? (
                                                  <span
                                                    className="space-x-1"
                                                    title="Teacher Overridden"
                                                  >
                                                    <span className="line-through text-muted-foreground text-[10px]">
                                                      {(tc.awardedScore ?? tc.score ?? 0).toFixed(
                                                        1
                                                      )}
                                                    </span>
                                                    <span className="font-bold text-amber-600 dark:text-amber-400">
                                                      {scoreToDisplay !== undefined &&
                                                      scoreToDisplay !== null
                                                        ? scoreToDisplay.toFixed(1)
                                                        : "—"}
                                                    </span>
                                                  </span>
                                                ) : tc.effectiveScore !== undefined &&
                                                  tc.awardedScore !== undefined ? (
                                                  tc.effectiveScore === tc.awardedScore ? (
                                                    <span className="font-bold text-foreground">
                                                      {tc.effectiveScore.toFixed(1)}
                                                    </span>
                                                  ) : (
                                                    <span
                                                      className="space-x-1"
                                                      title="Effective Score / Raw Score"
                                                    >
                                                      <span className="font-bold text-foreground">
                                                        {tc.effectiveScore.toFixed(1)}
                                                      </span>
                                                      <span className="text-[10px] text-muted-foreground">
                                                        ({tc.awardedScore.toFixed(1)})
                                                      </span>
                                                    </span>
                                                  )
                                                ) : (
                                                  <span className="font-bold text-foreground">
                                                    {scoreToDisplay !== undefined &&
                                                    scoreToDisplay !== null
                                                      ? scoreToDisplay.toFixed(1)
                                                      : isPassed
                                                        ? "1.0"
                                                        : "0.0"}
                                                  </span>
                                                )}
                                              </TableCell>
                                              <TableCell className="py-3 text-center">
                                                {hasDetails ? (
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleTestExpanded(idx);
                                                    }}
                                                    title="View Details"
                                                  >
                                                    {isExpanded ? (
                                                      <ChevronUp className="h-4 w-4" />
                                                    ) : (
                                                      <ChevronDown className="h-4 w-4" />
                                                    )}
                                                  </Button>
                                                ) : null}
                                              </TableCell>
                                            </>
                                          ) : (
                                            <>
                                              <TableCell className="py-3 min-w-[220px]">
                                                <div
                                                  className="text-xs text-foreground font-medium"
                                                  title={url}
                                                >
                                                  {url}
                                                </div>
                                              </TableCell>
                                              <TableCell className="py-3 text-center min-w-[100px]">
                                                {isPassed ? (
                                                  <Badge className="bg-emerald-500 hover:bg-emerald-500/90 text-white font-medium text-[11px] px-2.5 py-0.5 border-none">
                                                    ✓ Pass
                                                  </Badge>
                                                ) : (
                                                  <Badge
                                                    variant="destructive"
                                                    className="font-medium text-[11px] px-2.5 py-0.5"
                                                  >
                                                    ✗ Fail
                                                  </Badge>
                                                )}
                                              </TableCell>
                                              <TableCell className="py-3 text-right font-mono text-xs min-w-[80px]">
                                                {hasOverride ? (
                                                  <span
                                                    className="space-x-1"
                                                    title="Teacher Overridden"
                                                  >
                                                    <span className="line-through text-muted-foreground text-[10px]">
                                                      {(tc.awardedScore ?? tc.score ?? 0).toFixed(
                                                        1
                                                      )}
                                                    </span>
                                                    <span className="font-bold text-amber-600 dark:text-amber-400">
                                                      {scoreToDisplay !== undefined &&
                                                      scoreToDisplay !== null
                                                        ? scoreToDisplay.toFixed(1)
                                                        : "—"}
                                                    </span>
                                                  </span>
                                                ) : (
                                                  <span className="font-bold text-foreground">
                                                    {scoreToDisplay !== undefined &&
                                                    scoreToDisplay !== null
                                                      ? scoreToDisplay.toFixed(1)
                                                      : isPassed
                                                        ? "1.0"
                                                        : "0.0"}
                                                  </span>
                                                )}
                                              </TableCell>
                                              <TableCell className="py-3 text-center">
                                                {hasDetails ? (
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleTestExpanded(idx);
                                                    }}
                                                    title="View Details"
                                                  >
                                                    {isExpanded ? (
                                                      <ChevronUp className="h-4 w-4" />
                                                    ) : (
                                                      <ChevronDown className="h-4 w-4" />
                                                    )}
                                                  </Button>
                                                ) : null}
                                              </TableCell>
                                            </>
                                          )}
                                        </TableRow>

                                        {isExpanded && hasDetails ? (
                                          <TableRow className="bg-muted/10 hover:bg-muted/10 border-b border-border/50">
                                            <TableCell
                                              colSpan={hasApiDetails ? 6 : 4}
                                              className="py-3 px-6"
                                            >
                                              <div className="space-y-3">
                                                {/* Error Alert */}
                                                {err ? (
                                                  <div className="rounded-lg border border-red-200 bg-red-500/5 p-3 text-xs leading-relaxed text-red-600 dark:border-red-950/30 dark:text-red-400">
                                                    <div className="flex items-start gap-2">
                                                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                      <div>
                                                        <p className="font-bold mb-0.5">
                                                          Error Message:
                                                        </p>
                                                        <pre className="font-mono text-[11px] whitespace-pre-wrap">
                                                          {err}
                                                        </pre>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ) : null}

                                                {/* Manual Override Info */}
                                                {tc.overrideReason ? (
                                                  <div className="rounded-lg border border-amber-200 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-700 dark:border-amber-950/30 dark:text-amber-400">
                                                    <div className="flex items-start gap-2">
                                                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                      <div>
                                                        <p className="font-bold mb-0.5">
                                                          Teacher Override Reason:
                                                        </p>
                                                        <p className="font-sans italic">
                                                          {tc.overrideReason}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ) : null}

                                                {/* Actual Response */}
                                                {responseVal ? (
                                                  <div className="space-y-1">
                                                    <p className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                                                      <FileJson className="h-3.5 w-3.5" /> Actual
                                                      Response / Output
                                                    </p>
                                                    <div className="overflow-hidden rounded-lg border border-border bg-background">
                                                      <pre className="max-h-60 overflow-y-auto max-w-full overflow-x-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed text-foreground select-all bg-card">
                                                        {formatResponse(responseVal)}
                                                      </pre>
                                                    </div>
                                                  </div>
                                                ) : null}
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        ) : null}
                                      </React.Fragment>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </Card>
                        </div>
                      );
                    })()
                  ) : (
                    <Card className="p-6 text-sm text-center text-muted-foreground">
                      No testcase results found in this attempt.
                    </Card>
                  )}
                </>
              ) : (
                <Card className="p-6 text-sm text-center text-muted-foreground">
                  Select an attempt from the history sidebar to view details.
                </Card>
              )}
            </div>

            {/* Right Column: History Sidebar (Desktop only) */}
            <div className="hidden lg:block lg:order-first lg:sticky lg:top-[68px] lg:self-start space-y-4 max-h-[calc(100vh-100px)] overflow-y-auto pr-2">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Submission History ({attempts.length})
              </h3>

              {/* Sidebar Attempt Cards */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {attempts
                  .slice()
                  .reverse()
                  .map((attempt) => {
                    const isSelected = attempt.id === selectedAttemptId;
                    const isPassed = attempt.status === "passed";
                    const isFailed = attempt.status === "failed";
                    return (
                      <button
                        key={attempt.id}
                        onClick={() => handleSelectAttempt(attempt.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-2 ${
                          isSelected
                            ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm"
                            : "border-border bg-card hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-foreground">
                            Attempt #{attempt.attempt_no}
                          </span>
                          {attempt.item_type && attempt.item_type !== "original" ? (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                              {attempt.item_type}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between w-full text-xs">
                          <span className="font-semibold text-foreground">
                            Score: {attempt.score !== null ? attempt.score.toFixed(2) : "—"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isPassed
                                  ? "bg-emerald-500"
                                  : isFailed
                                    ? "bg-red-600"
                                    : "bg-amber-500 animate-pulse"
                              }`}
                            />
                            <span className="text-[11px] capitalize text-muted-foreground">
                              {attempt.status}
                            </span>
                          </span>
                        </div>

                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatDate(attempt.submitted_at)}
                        </span>
                      </button>
                    );
                  })}
              </div>

              {/* Latest Resubmission Request Card inside Sidebar */}
              {request ? (
                <div className="border border-border/80 rounded-lg p-3 bg-muted/30 space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      {request.request_type === "late" ? "Late Request" : "Resubmit Request"}
                    </span>
                    <Badge
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.5 border-none ${
                        request.status === "pending"
                          ? "bg-amber-500 text-white"
                          : request.status === "approved"
                            ? "bg-emerald-500 text-white"
                            : request.status === "completed"
                              ? "bg-sky-600 text-white"
                              : "bg-red-600 text-white"
                      }`}
                    >
                      {request.status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Last updated: {formatDate(request.updated_at)}
                  </p>
                  {request.admin_note ? (
                    <div className="rounded border border-red-200 bg-red-500/5 p-2 text-[10px] text-red-600 dark:border-red-950/30 dark:text-red-400">
                      <span className="font-bold">Feedback:</span> {request.admin_note}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>

      {/* Attempt Resubmission Dialog */}
      <Dialog
        open={resubmitDialogOpen}
        onOpenChange={(next) => {
          if (!next) {
            setDriveLink("");
            setResubmitNote("");
          }
          setResubmitDialogOpen(next);
        }}
      >
        <DialogContent className="font-quicksand">
          <DialogHeader>
            <DialogTitle>
              {requestType === "late" ? "Request Late Submission" : "Request Resubmission"}
            </DialogTitle>
            <DialogDescription>
              {requestType === "late"
                ? "Submit a Google Drive link to request a late first submission for this lab."
                : "Submit a Google Drive link to request a resubmission for this lab. You may request a resubmission up to 3 times per lab."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50/50 p-3.5 text-sm leading-relaxed text-red-800 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-200">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-100/80 text-red-600 dark:bg-red-950 dark:text-red-400">
                <TriangleAlert className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-red-800 dark:text-red-300">Important Note</p>
                <p className="mt-0.5 text-xs text-red-700 dark:text-red-400 font-medium">
                  Please do not spam requests. Kindly wait for the admin to review and process your
                  submission.
                </p>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-primary/25 bg-primary/[0.04] p-3.5 text-sm leading-relaxed text-foreground ring-1 ring-primary/10">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <TriangleAlert className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-primary">Submission file requirement</p>
                <p className="mt-0.5 text-xs text-muted-foreground font-medium">
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Google Drive Link
              </label>
              <Input
                value={driveLink}
                onChange={(event) => setDriveLink(event.target.value)}
                placeholder="https://drive.google.com/..."
                aria-label="Google Drive submission request link"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Note (Optional)</label>
              <Textarea
                value={resubmitNote}
                onChange={(event) => setResubmitNote(event.target.value)}
                placeholder={
                  requestType === "late"
                    ? "Explain why this submission is late..."
                    : "Message or explanation for admin..."
                }
                className="min-h-[96px]"
                aria-label="Resubmission note"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDriveLink("");
                setResubmitNote("");
                setResubmitDialogOpen(false);
              }}
              disabled={submittingResubmit}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveResubmit} disabled={!driveLink.trim() || submittingResubmit}>
              {requestType === "late" ? "Submit Late Request" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
