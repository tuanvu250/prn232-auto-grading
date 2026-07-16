"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileDown,
  FolderOpen,
  RefreshCw,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SubmissionDetailDialog } from "@/components/admin/SubmissionDetailDialog";
import { TablePagination } from "@/components/admin/TablePagination";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  deleteStudentSubmissionAction,
  updateStudentSubmissionAction,
} from "@/lib/actions/erd-admin";
import {
  adminQueryKeys,
  adminSessionSubmissionsQueryOptions,
  adminSessionStudentsQueryOptions,
  adminStudentDetailsQueryOptions,
} from "@/lib/queries/admin";
import type {
  GradingSessionStudentResult,
  SessionSubmission,
  SubmissionStatus,
} from "@/lib/types/erd";

function scoreLabel(score: number | null) {
  return score === null ? "—" : score.toFixed(2);
}

function excelSafeFilename(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_");
}

function statusBadge(status: SubmissionStatus | null) {
  if (!status) return <Badge variant="outline">No submission</Badge>;
  if (status === "passed")
    return (
      <Badge
        className="border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"
        variant="outline"
      >
        Passed
      </Badge>
    );
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  return (
    <Badge
      className="border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-300"
      variant="outline"
    >
      Grading
    </Badge>
  );
}

export default function AdminSessionStudentsPage() {
  const params = useParams<{ termId: string; classId: string; sessionId: string }>();
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(
    adminSessionStudentsQueryOptions(params.termId, params.classId, params.sessionId)
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<GradingSessionStudentResult | null>(null);
  const [attempts, setAttempts] = useState<SessionSubmission[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [editing, setEditing] = useState<SessionSubmission | null>(null);
  const [score, setScore] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SessionSubmission | null>(null);
  const openedStudentRef = useRef<string | null>(null);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.results ?? []).filter((row) => {
      const matchesQuery =
        !normalized ||
        [row.student_code, row.student_name, row.student_email]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalized));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "not_submitted"
          ? row.latest_status === null
          : row.latest_status === statusFilter);
      return matchesQuery && matchesStatus;
    });
  }, [data?.results, query, statusFilter]);

  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedRows = rows.slice(startIndex, startIndex + pageSize);
  const results = data?.results ?? [];
  const summary = {
    total: results.length,
    passed: results.filter((row) => row.latest_status === "passed").length,
    failed: results.filter((row) => row.latest_status === "failed").length,
    grading: results.filter((row) => row.latest_status === "grading").length,
    notSubmitted: results.filter((row) => row.latest_status === null).length,
  };

  const loadAttempts = useCallback(
    async (student: GradingSessionStudentResult) => {
      setSelectedStudent(student);
      setLoadingAttempts(true);
      try {
        const result = await queryClient.fetchQuery(
          adminStudentDetailsQueryOptions(
            params.termId,
            params.classId,
            params.sessionId,
            student.class_student_id,
            student.attempt_count > 0
          )
        );
        setAttempts(result);
      } catch (loadError) {
        toast.error(loadError instanceof Error ? loadError.message : "Unable to load attempts");
        setAttempts([]);
      } finally {
        setLoadingAttempts(false);
      }
    },
    [params.classId, params.sessionId, params.termId, queryClient]
  );

  useEffect(() => {
    const requestedStudentId = new URLSearchParams(window.location.search).get("student");
    if (!requestedStudentId || openedStudentRef.current === requestedStudentId) return;
    const student = data?.results.find((row) => row.class_student_id === requestedStudentId);
    if (!student) return;
    openedStudentRef.current = requestedStudentId;
    const timer = window.setTimeout(() => void loadAttempts(student), 0);
    return () => window.clearTimeout(timer);
  }, [data?.results, loadAttempts]);

  const refreshStudent = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.sessionStudents(params.termId, params.classId, params.sessionId),
    });
    if (selectedStudent) await loadAttempts(selectedStudent);
  };

  const refreshResults = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.sessionStudents(params.termId, params.classId, params.sessionId),
    });
    toast.success("Results refreshed.");
  };

  const exportResults = async () => {
    if (!rows.length) return;
    setIsExporting(true);
    try {
      const [XLSX, allAttempts] = await Promise.all([
        import("xlsx"),
        queryClient.fetchQuery(
          adminSessionSubmissionsQueryOptions(params.termId, params.classId, params.sessionId)
        ),
      ]);
      const visibleIds = new Set(rows.map((row) => row.class_student_id));
      const studentById = new Map(rows.map((row) => [row.class_student_id, row]));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
          rows.map((row) => ({
            "Student Code": row.student_code,
            "Full Name": row.student_name ?? "",
            Email: row.student_email,
            Attempts: row.attempt_count,
            "Latest Score": row.latest_score ?? "",
            Status: row.latest_status ?? "not_submitted",
          }))
        ),
        "Student Summary"
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
          allAttempts
            .filter((attempt) => visibleIds.has(attempt.class_student_id))
            .map((attempt) => ({
              "Student Code": studentById.get(attempt.class_student_id)?.student_code ?? "",
              "Attempt No": attempt.attempt_no,
              Type: attempt.item_type,
              Score: attempt.score ?? "",
              Status: attempt.status,
              "Source URL": attempt.source_url ?? "",
              "Submitted At": attempt.submitted_at,
            }))
        ),
        "Submission Attempts"
      );
      XLSX.writeFile(
        workbook,
        excelSafeFilename(
          `${data?.termName ?? "Term"}_${data?.className ?? "Class"}_${data?.session?.lab_code ?? "Lab"}_results.xlsx`
        )
      );
      toast.success(`Exported ${rows.length} students.`);
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : "Unable to export results.");
    } finally {
      setIsExporting(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Attempt is not selected");
      const numericScore = Number(score);
      if (!Number.isFinite(numericScore) || numericScore < 0) {
        throw new Error("Score must be a non-negative number");
      }
      return updateStudentSubmissionAction(editing.id, {
        score: numericScore,
        status: numericScore >= 5 ? "passed" : "failed",
        sourceUrl,
      });
    },
    onSuccess: async () => {
      await refreshStudent();
      toast.success("Attempt updated.");
      setEditing(null);
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!deleteTarget) throw new Error("Attempt is not selected");
      return deleteStudentSubmissionAction(deleteTarget.id);
    },
    onSuccess: async () => {
      await refreshStudent();
      toast.success("Attempt deleted.");
      setDeleteTarget(null);
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const openEditor = (attempt: SessionSubmission) => {
    setEditing(attempt);
    setScore(attempt.score?.toString() ?? "");
    setSourceUrl(attempt.source_url ?? "");
  };

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-6 p-4 sm:p-6 lg:px-8 lg:pb-4 lg:pt-6">
      <AdminPageHeader
        breadcrumbs={[
          { label: "Terms", href: "/admin/terms" },
          { label: data?.termName ?? "Term", href: `/admin/terms/${params.termId}/classes` },
          {
            label: data?.className ?? "Class",
            href: `/admin/terms/${params.termId}/classes/${params.classId}/sessions`,
          },
          { label: data?.session?.lab_code ?? "Lab" },
          { label: "Students" },
        ]}
        title={`Student Results for ${data?.session?.lab_code ?? "Lab"}`}
        description="Monitor scores, check submission attempts and review diagnostic results."
        backHref={`/admin/terms/${params.termId}/classes/${params.classId}/sessions`}
        actions={
          <>
            {data?.session?.drive_root_url ? (
              <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" asChild>
                <a href={data.session.drive_root_url} target="_blank" rel="noreferrer">
                  <FolderOpen className="mr-2 h-4 w-4" /> Open Drive
                  <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={exportResults}
              disabled={isPending || isExporting || rows.length === 0}
            >
              {isExporting ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Export Excel
            </Button>
            <Button size="sm" variant="outline" onClick={refreshResults} disabled={isPending}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </>
        }
      />

      {isPending ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[74px] rounded-lg" />
          ))}
        </div>
      ) : results.length ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            { label: "Total Enrolled", value: summary.total, icon: Users, tone: "primary" },
            { label: "Passed", value: summary.passed, icon: CheckCircle2, tone: "emerald" },
            { label: "Failed", value: summary.failed, icon: XCircle, tone: "red" },
            { label: "Grading", value: summary.grading, icon: RefreshCw, tone: "amber" },
            {
              label: "Not Submitted",
              value: summary.notSubmitted,
              icon: AlertCircle,
              tone: "muted",
            },
          ].map((item) => {
            const Icon = item.icon;
            const tones = {
              primary: "bg-primary/10 text-primary",
              emerald: "bg-emerald-500/10 text-emerald-600",
              red: "bg-red-500/10 text-red-600",
              amber: "bg-amber-500/10 text-amber-600",
              muted: "bg-muted text-muted-foreground",
            };
            return (
              <Card
                key={item.label}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-none"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${tones[item.tone as keyof typeof tones]}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className="font-mono text-lg font-bold">{item.value}</p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Card className="flex flex-col gap-3 rounded-lg border border-border p-4 shadow-none sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search student ID, name or email..."
              className="pl-9"
              aria-label="Search session students"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="grading">Grading</SelectItem>
              <SelectItem value="not_submitted">Not submitted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{rows.length}</span> of{" "}
          {results.length} students
        </p>
      </Card>

      {error ? (
        <Card className="border-destructive/40 p-6 text-sm text-destructive">
          Unable to load results: {error.message}
        </Card>
      ) : isPending ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : (
        <div className="flex flex-1 flex-col gap-6">
          <Card className="overflow-hidden rounded-lg border border-border shadow-none">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="pl-6">Student ID</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Attempts</TableHead>
                    <TableHead className="text-right">Latest Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.length ? (
                    paginatedRows.map((row) => (
                      <TableRow key={row.class_student_id}>
                        <TableCell className="pl-6 font-mono text-sm font-bold">
                          {row.student_code}
                        </TableCell>
                        <TableCell className="font-medium">{row.student_name || "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {row.student_email}
                        </TableCell>
                        <TableCell className="text-center font-mono">{row.attempt_count}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {scoreLabel(row.latest_score)}
                        </TableCell>
                        <TableCell>{statusBadge(row.latest_status)}</TableCell>
                        <TableCell className="pr-6 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => loadAttempts(row)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View details</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        No students match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <TablePagination
            fullBleed
            pagination={{
              page: activePage,
              pageSize,
              total: rows.length,
              totalPages,
            }}
            loading={isPending}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      <SubmissionDetailDialog
        student={selectedStudent}
        attempts={attempts}
        loading={loadingAttempts}
        onClose={() => setSelectedStudent(null)}
        onEdit={openEditor}
        onDelete={setDeleteTarget}
      />

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit attempt</DialogTitle>
            <DialogDescription>
              The pass/fail status is recalculated from the score.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="attempt-score">Score</Label>
              <Input
                id="attempt-score"
                type="number"
                min="0"
                step="0.01"
                value={score}
                onChange={(event) => setScore(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attempt-source">Source URL</Label>
              <Input
                id="attempt-source"
                type="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save attempt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete attempt?</DialogTitle>
            <DialogDescription>
              Legacy attempts connected to archived requests cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete attempt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
