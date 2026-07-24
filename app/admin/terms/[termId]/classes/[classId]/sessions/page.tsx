"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Code2,
  FileDown,
  FileSpreadsheet,
  FolderOpen,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { GradeMatrix } from "@/components/admin/GradeMatrix";
import { ImportStudentsExcelDialog } from "@/components/admin/ImportStudentsExcelDialog";
import { SubmissionDetailDialog } from "@/components/admin/SubmissionDetailDialog";
import { StudentRosterSidebar } from "@/components/admin/StudentRosterSidebar";
import { TablePagination } from "@/components/admin/TablePagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
  createLabAction,
  createGradingSessionsAction,
  deleteGradingSessionAction,
  setStudentSubmissionScoreEightAction,
  updateGradingSessionAction,
} from "@/lib/actions/erd-admin";
import {
  adminClassWorkspaceQueryOptions,
  adminStudentDetailsQueryOptions,
} from "@/lib/queries/admin";
import { invalidateAdminClassCaches, invalidateAdminTermCaches } from "@/lib/queries/invalidation";
import type {
  ClassGradeMatrixResult,
  ClassStudentRosterRow,
  GradingSession,
  GradingSessionStatus,
  GradingSessionStudentResult,
  SessionSubmission,
} from "@/lib/types/erd";
import { cn } from "@/lib/utils";
import { compareNaturalText, selectLatestMatrixLabSessions } from "@/lib/utils/grading-session";

function formatDeadline(deadline: string | null) {
  if (!deadline) return "No deadline";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(deadline));
}

function toLocalInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function excelSafeFilename(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_");
}

function displayScore(score: number | null | undefined) {
  return score === null || score === undefined ? "" : Math.min(score, 10);
}

type SessionDraft = {
  name: string;
  deadline: string;
  driveRootUrl: string;
  status: GradingSessionStatus;
};

type ViewMode = "cards" | "table";

const CREATE_LAB_VALUE = "__create_new_lab__";

type MatrixScoreEightTarget = {
  student: ClassStudentRosterRow;
  session: GradingSession;
};

type MatrixDetailTarget = MatrixScoreEightTarget & {
  result: ClassGradeMatrixResult;
};

export default function AdminGradingSessionsPage() {
  const params = useParams<{ termId: string; classId: string }>();
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(
    adminClassWorkspaceQueryOptions(params.termId, params.classId)
  );
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedLabId, setSelectedLabId] = useState("");
  const [creatingLab, setCreatingLab] = useState(false);
  const [newLabCode, setNewLabCode] = useState("");
  const [newLabTitle, setNewLabTitle] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([params.classId]);
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [driveRootUrls, setDriveRootUrls] = useState<Record<string, string>>({
    [params.classId]: "",
  });
  const [editing, setEditing] = useState<GradingSession | null>(null);
  const [editDraft, setEditDraft] = useState<SessionDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GradingSession | null>(null);
  const [scoreEightTarget, setScoreEightTarget] = useState<MatrixScoreEightTarget | null>(null);
  const [detailStudent, setDetailStudent] = useState<GradingSessionStudentResult | null>(null);
  const [detailAttempts, setDetailAttempts] = useState<SessionSubmission[]>([]);
  const [loadingDetailAttempts, setLoadingDetailAttempts] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingMissing, setIsExportingMissing] = useState(false);

  useEffect(() => {
    const syncViewMode = () => {
      const searchParams = new URLSearchParams(window.location.search);
      setViewMode(searchParams.get("view") === "table" ? "table" : "cards");
    };
    const searchParams = new URLSearchParams(window.location.search);
    const timer = window.setTimeout(() => {
      if (searchParams.get("create") === "1") setCreateOpen(true);
      syncViewMode();
    }, 0);
    window.addEventListener("popstate", syncViewMode);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", syncViewMode);
    };
  }, []);

  const refreshClassWorkspace = () =>
    invalidateAdminClassCaches(queryClient, params.termId, params.classId);

  const refreshTermWorkspace = () => invalidateAdminTermCaches(queryClient, params.termId);

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await createGradingSessionsAction({
        termId: params.termId,
        targets: selectedClassIds.map((classId) => ({
          classId,
          driveRootUrl: driveRootUrls[classId] ?? "",
        })),
        labId: selectedLabId,
        name,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      });
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: async (result) => {
      await refreshTermWorkspace();
      toast.success(`Created ${result.created} grading session${result.created === 1 ? "" : "s"}.`);
      setCreateOpen(false);
      setSelectedLabId("");
      setCreatingLab(false);
      setNewLabCode("");
      setNewLabTitle("");
      setSelectedClassIds([params.classId]);
      setName("");
      setDeadline("");
      setDriveRootUrls({ [params.classId]: "" });
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const createLabMutation = useMutation({
    mutationFn: () => createLabAction(newLabCode, newLabTitle.trim() || null),
    onSuccess: async (lab) => {
      await refreshTermWorkspace();
      setSelectedLabId(lab.id);
      setCreatingLab(false);
      setNewLabCode("");
      setNewLabTitle("");
      toast.success(`${lab.code} was created and selected.`);
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing || !editDraft) throw new Error("Session is not selected");
      return updateGradingSessionAction(editing.id, {
        ...editDraft,
        deadline: editDraft.deadline ? new Date(editDraft.deadline).toISOString() : null,
      });
    },
    onSuccess: async () => {
      await refreshClassWorkspace();
      toast.success("Session updated.");
      setEditing(null);
      setEditDraft(null);
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!deleteTarget) throw new Error("Session is not selected");
      return deleteGradingSessionAction(deleteTarget.id);
    },
    onSuccess: async () => {
      await refreshClassWorkspace();
      toast.success("Session deleted.");
      setDeleteTarget(null);
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const setScoreEightMutation = useMutation({
    mutationFn: ({ student, session }: MatrixScoreEightTarget) =>
      setStudentSubmissionScoreEightAction(student.class_student_id, session.id),
    onSuccess: async (_, { student, session }) => {
      await refreshClassWorkspace();
      toast.success(`Set ${student.student_code} to 8.00 for ${session.name}.`);
      setScoreEightTarget(null);
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const orderedSessions = useMemo(
    () =>
      [...(data?.sessions ?? [])].sort(
        (left, right) =>
          compareNaturalText(left.lab_code, right.lab_code) ||
          compareNaturalText(left.name, right.name) ||
          left.created_at.localeCompare(right.created_at)
      ),
    [data?.sessions]
  );

  const sessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visibleSessions = normalized
      ? orderedSessions.filter((session) =>
          [session.name, session.lab_code, session.lab_title]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalized))
        )
      : orderedSessions;

    return visibleSessions;
  }, [orderedSessions, query]);

  const gradeMatrixSessions = useMemo(
    () => selectLatestMatrixLabSessions(orderedSessions),
    [orderedSessions]
  );

  const matrixView = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return { students: data?.students ?? [], sessions: gradeMatrixSessions };
    }

    const matchingStudents = (data?.students ?? []).filter((student) =>
      [student.student_code, student.student_name, student.student_email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized))
    );
    const matchingSessions = gradeMatrixSessions.filter((session) =>
      [session.name, session.lab_code, session.lab_title]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized))
    );

    return {
      students: matchingStudents.length
        ? matchingStudents
        : matchingSessions.length
          ? (data?.students ?? [])
          : [],
      sessions: matchingSessions.length
        ? matchingSessions
        : matchingStudents.length
          ? gradeMatrixSessions
          : [],
    };
  }, [data?.students, gradeMatrixSessions, query]);

  const missingSubmissionCount = useMemo(() => {
    const students = data?.students ?? [];
    if (!students.length || !gradeMatrixSessions.length) return 0;

    const submittedCells = new Set(
      (data?.gradeMatrix ?? []).map(
        (result) => `${result.class_student_id}:${result.grading_session_id}`
      )
    );

    return students.reduce(
      (count, student) =>
        count +
        gradeMatrixSessions.filter(
          (session) => !submittedCells.has(`${student.class_student_id}:${session.id}`)
        ).length,
      0
    );
  }, [data?.gradeMatrix, data?.students, gradeMatrixSessions]);

  const totalPages = Math.ceil(sessions.length / pageSize) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedSessions = sessions.slice(startIndex, startIndex + pageSize);

  const changeViewMode = (nextView: ViewMode) => {
    setViewMode(nextView);
    setCurrentPage(1);
    const searchParams = new URLSearchParams(window.location.search);
    if (nextView === "table") searchParams.set("view", "table");
    else searchParams.delete("view");
    const queryString = searchParams.toString();
    window.history.pushState(null, "", queryString ? `?${queryString}` : window.location.pathname);
  };

  const exportGradeMatrix = async () => {
    if (!matrixView.students.length || !matrixView.sessions.length) return;
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const resultByCell = new Map(
        (data?.gradeMatrix ?? []).map((result) => [
          `${result.class_student_id}:${result.grading_session_id}`,
          result,
        ])
      );
      const rows = matrixView.students.map((student) => {
        const row: Record<string, string | number> = {
          "Student ID": student.student_code,
          "Full name": student.student_name ?? "",
          Email: student.student_email,
        };
        for (const session of matrixView.sessions) {
          const result = resultByCell.get(`${student.class_student_id}:${session.id}`);
          row[`${session.lab_code} - ${session.name}`] = displayScore(result?.latest_score);
        }
        return row;
      });
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 16 },
        { wch: 28 },
        { wch: 32 },
        ...matrixView.sessions.map(() => ({ wch: 20 })),
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, "Grade Matrix");
      XLSX.writeFile(
        workbook,
        excelSafeFilename(
          `${data?.termName ?? "Term"}_${data?.className ?? "Class"}_grade_matrix.xlsx`
        )
      );
      toast.success(`Exported ${rows.length} students.`);
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : "Unable to export grades.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportMissingGradeMatrix = async () => {
    const students = data?.students ?? [];
    if (!students.length || !gradeMatrixSessions.length) return;

    setIsExportingMissing(true);
    try {
      const XLSX = await import("xlsx");
      const resultByCell = new Map(
        (data?.gradeMatrix ?? []).map((result) => [
          `${result.class_student_id}:${result.grading_session_id}`,
          result,
        ])
      );

      const overviewRows = students.map((student) => {
        const missingSessions = gradeMatrixSessions.filter(
          (session) => !resultByCell.has(`${student.class_student_id}:${session.id}`)
        );
        const row: Record<string, string | number> = {
          "Student ID": student.student_code,
          "Full name": student.student_name ?? "",
          Email: student.student_email,
          "Missing Count": missingSessions.length,
          "Missing Labs": missingSessions
            .map((session) => `${session.lab_code} - ${session.name}`)
            .join(", "),
        };

        for (const session of gradeMatrixSessions) {
          const result = resultByCell.get(`${student.class_student_id}:${session.id}`);
          row[`${session.lab_code} - ${session.name}`] = result ? "Submitted" : "Missing";
        }

        return row;
      });

      const missingRows = students.flatMap((student) =>
        gradeMatrixSessions
          .filter((session) => !resultByCell.has(`${student.class_student_id}:${session.id}`))
          .map((session) => ({
            "Student ID": student.student_code,
            "Full name": student.student_name ?? "",
            Email: student.student_email,
            Lab: session.lab_code,
            Session: session.name,
          }))
      );

      const workbook = XLSX.utils.book_new();
      const overviewWorksheet = XLSX.utils.json_to_sheet(overviewRows);
      overviewWorksheet["!cols"] = [
        { wch: 16 },
        { wch: 28 },
        { wch: 32 },
        { wch: 14 },
        { wch: 42 },
        ...gradeMatrixSessions.map(() => ({ wch: 20 })),
      ];
      XLSX.utils.book_append_sheet(workbook, overviewWorksheet, "Missing Overview");

      const detailWorksheet = XLSX.utils.json_to_sheet(missingRows);
      detailWorksheet["!cols"] = [{ wch: 16 }, { wch: 28 }, { wch: 32 }, { wch: 12 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(workbook, detailWorksheet, "Missing Details");

      XLSX.writeFile(
        workbook,
        excelSafeFilename(
          `${data?.termName ?? "Term"}_${data?.className ?? "Class"}_missing_lab_overview.xlsx`
        )
      );
      toast.success(`Exported ${missingRows.length} missing lab record(s).`);
    } catch (exportError) {
      toast.error(
        exportError instanceof Error
          ? exportError.message
          : "Unable to export missing lab overview."
      );
    } finally {
      setIsExportingMissing(false);
    }
  };

  const openMatrixDetails = async ({ student, session, result }: MatrixDetailTarget) => {
    setDetailStudent({
      class_student_id: student.class_student_id,
      student_code: student.student_code,
      student_name: student.student_name,
      student_email: student.student_email,
      attempt_count: result.attempt_count,
      latest_attempt_no: result.latest_attempt_no,
      latest_score: result.latest_score,
      latest_status: result.latest_status,
    });
    setDetailAttempts([]);
    setLoadingDetailAttempts(true);

    try {
      const attempts = await queryClient.fetchQuery(
        adminStudentDetailsQueryOptions(
          params.termId,
          params.classId,
          session.id,
          student.class_student_id,
          result.attempt_count > 0
        )
      );
      setDetailAttempts(attempts);
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Unable to load attempts");
      setDetailAttempts([]);
    } finally {
      setLoadingDetailAttempts(false);
    }
  };

  const openEditor = (session: GradingSession) => {
    setEditing(session);
    setEditDraft({
      name: session.name,
      deadline: toLocalInputValue(session.deadline),
      driveRootUrl: session.drive_root_url ?? "",
      status: session.status,
    });
  };

  const toggleClass = (classId: string, checked: boolean) => {
    setSelectedClassIds((current) =>
      checked ? Array.from(new Set([...current, classId])) : current.filter((id) => id !== classId)
    );
    if (checked) {
      setDriveRootUrls((current) => ({ ...current, [classId]: current[classId] ?? "" }));
    }
  };

  return (
    <div className="min-h-full lg:h-full lg:overflow-hidden">
      <div
        className={cn(
          "grid min-h-full min-w-0 lg:h-full lg:min-h-0",
          viewMode === "cards" && "lg:grid-cols-[minmax(0,1fr)_20rem]"
        )}
      >
        <main
          className={cn(
            "order-last flex min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 lg:order-first lg:h-full lg:px-8 lg:pb-4 lg:pt-6",
            viewMode === "table" ? "lg:min-h-0 lg:overflow-hidden" : "lg:overflow-y-auto"
          )}
        >
          <AdminPageHeader
            breadcrumbs={[
              { label: "Terms", href: "/admin/terms" },
              { label: data?.termName ?? "Term", href: `/admin/terms/${params.termId}/classes` },
              { label: data?.className ?? "Class" },
            ]}
            title="Grading sessions"
            description="Open, close and review independent submission windows for this class."
            backHref={`/admin/terms/${params.termId}/classes`}
            actions={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create session
              </Button>
            }
          />

          <div className="flex flex-col gap-3 border-t border-border pt-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder={
                  viewMode === "table"
                    ? "Search student, session or lab code"
                    : "Search name or lab code"
                }
                className="pl-9"
                aria-label={
                  viewMode === "table" ? "Search grade matrix" : "Search grading sessions"
                }
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              {viewMode === "table" ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Students
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportGradeMatrix}
                    disabled={
                      isPending ||
                      isExporting ||
                      matrixView.students.length === 0 ||
                      matrixView.sessions.length === 0
                    }
                  >
                    {isExporting ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    {isExporting ? "Exporting…" : "Export Excel"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportMissingGradeMatrix}
                    disabled={
                      isPending ||
                      isExportingMissing ||
                      gradeMatrixSessions.length === 0 ||
                      missingSubmissionCount === 0
                    }
                  >
                    {isExportingMissing ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    {isExportingMissing ? "Exporting…" : "Export Missing"}
                  </Button>
                </>
              ) : null}
              <div
                className="inline-flex h-9 overflow-hidden rounded-md border border-border bg-background"
                role="group"
                aria-label="Grading session view"
              >
                <button
                  type="button"
                  className={cn(
                    "inline-flex min-w-24 items-center justify-center gap-2 px-3 text-sm font-medium outline-none transition-colors focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    viewMode === "cards"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  aria-pressed={viewMode === "cards"}
                  onClick={() => changeViewMode("cards")}
                >
                  <LayoutGrid className="h-4 w-4" /> Cards
                </button>
                <button
                  type="button"
                  className={cn(
                    "inline-flex min-w-24 items-center justify-center gap-2 border-l border-border px-3 text-sm font-medium outline-none transition-colors focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    viewMode === "table"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  aria-pressed={viewMode === "table"}
                  onClick={() => changeViewMode("table")}
                >
                  <Table2 className="h-4 w-4" /> Table
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                {orderedSessions.length} session{orderedSessions.length === 1 ? "" : "s"} ·{" "}
                {data?.students.length ?? 0} students
              </p>
            </div>
          </div>

          {error ? (
            <Card className="border-destructive/40 p-6 text-sm text-destructive">
              Unable to load grading sessions: {error.message}
            </Card>
          ) : isPending ? (
            <div className="space-y-3">
              {Array.from({ length: viewMode === "table" ? 8 : 4 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className={viewMode === "table" ? "h-12 w-full" : "h-24 w-full"}
                />
              ))}
            </div>
          ) : orderedSessions.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 border-y border-dashed border-border text-center">
              <CalendarClock className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-semibold">No grading sessions found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create one session for this class or apply it to several classes in the term.
                </p>
              </div>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create the first session
              </Button>
            </div>
          ) : viewMode === "table" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <GradeMatrix
                termId={params.termId}
                classId={params.classId}
                sessions={matrixView.sessions}
                students={matrixView.students}
                results={data?.gradeMatrix ?? []}
                onViewDetails={openMatrixDetails}
                onSetScoreEight={setScoreEightTarget}
                settingScoreEight={setScoreEightMutation.isPending}
                settingScoreEightCell={
                  setScoreEightMutation.variables
                    ? {
                        classStudentId: setScoreEightMutation.variables.student.class_student_id,
                        sessionId: setScoreEightMutation.variables.session.id,
                      }
                    : null
                }
                emptyMessage={
                  query.trim()
                    ? "No students or grading sessions match this search."
                    : "No students are enrolled in this class yet. Import a roster to begin."
                }
              />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center border-y border-dashed border-border text-center">
              <p className="font-semibold">No grading sessions match this search</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different session name or lab code.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {paginatedSessions.map((session) => (
                  <Card
                    key={session.id}
                    className="group relative flex h-full items-center gap-3 rounded-lg border border-border bg-card p-5 shadow-none transition-all hover:border-primary/50"
                  >
                    <Link
                      href={`/admin/terms/${params.termId}/classes/${params.classId}/sessions/${session.id}/students`}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md pr-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        <Code2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold tracking-tight text-foreground">
                          {session.name}
                        </p>
                        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {session.lab_code} · {session.status} · {formatDeadline(session.deadline)}
                        </p>
                      </div>
                    </Link>

                    <div className="absolute right-4 top-1/2 flex -translate-y-1/2 gap-1 opacity-100 transition-opacity xl:opacity-0 xl:group-focus-within:opacity-100 xl:group-hover:opacity-100">
                      {session.drive_root_url ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 p-0 text-muted-foreground hover:bg-primary/5 hover:text-primary"
                          asChild
                        >
                          <a
                            href={session.drive_root_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Open Drive"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            <span className="sr-only">Open Drive</span>
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0 text-muted-foreground hover:bg-primary/5 hover:text-primary"
                        onClick={() => openEditor(session)}
                        title="Manage session"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                        <span className="sr-only">Manage session</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        onClick={() => setDeleteTarget(session)}
                        aria-label={`Delete ${session.name}`}
                        title="Delete session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              <TablePagination
                fullBleed
                pagination={{
                  page: activePage,
                  pageSize,
                  total: sessions.length,
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
        </main>

        {viewMode === "cards" ? (
          <StudentRosterSidebar
            classId={params.classId}
            className={data?.className ?? "Class"}
            students={data?.students ?? []}
            loading={isPending}
            onRosterImported={refreshClassWorkspace}
          />
        ) : null}
      </div>

      <ImportStudentsExcelDialog
        classId={params.classId}
        className={data?.className ?? "Class"}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={refreshClassWorkspace}
      />

      <SubmissionDetailDialog
        student={detailStudent}
        attempts={detailAttempts}
        loading={loadingDetailAttempts}
        onClose={() => {
          setDetailStudent(null);
          setDetailAttempts([]);
        }}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create grading sessions</DialogTitle>
            <DialogDescription>
              One configuration creates an independent session for every selected class.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="session-lab">Lab</Label>
                <Select
                  value={selectedLabId}
                  onValueChange={(value) => {
                    if (value === CREATE_LAB_VALUE) {
                      setCreatingLab(true);
                      return;
                    }
                    setSelectedLabId(value);
                    setCreatingLab(false);
                  }}
                >
                  <SelectTrigger id="session-lab">
                    <SelectValue placeholder="Select a lab" />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.catalog ?? []).map((lab) => (
                      <SelectItem key={lab.id} value={lab.id}>
                        {lab.code}
                        {lab.title ? ` · ${lab.title}` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value={CREATE_LAB_VALUE}
                      className="mt-1 border-t border-border pt-2 font-medium text-primary"
                    >
                      <span className="flex items-center gap-2">
                        <Plus className="h-3.5 w-3.5" /> Create new lab
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="session-name">Session name</Label>
                <Input
                  id="session-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Lab 1 - Main session"
                />
              </div>
            </div>
            {creatingLab ? (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="mb-3">
                  <p className="text-sm font-medium">Create a new lab</p>
                  <p className="text-xs text-muted-foreground">
                    The new lab will be selected for this session after it is created.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-lab-code">Lab code</Label>
                    <Input
                      id="new-lab-code"
                      value={newLabCode}
                      onChange={(event) => setNewLabCode(event.target.value)}
                      placeholder="LAB3"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-lab-title">Title</Label>
                    <Input
                      id="new-lab-title"
                      value={newLabTitle}
                      onChange={(event) => setNewLabTitle(event.target.value)}
                      placeholder="Optional lab title"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCreatingLab(false);
                        setNewLabCode("");
                        setNewLabTitle("");
                      }}
                      disabled={createLabMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => createLabMutation.mutate()}
                      disabled={createLabMutation.isPending || !newLabCode.trim()}
                    >
                      {createLabMutation.isPending ? "Creating…" : "Create lab"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="max-w-sm space-y-1.5">
              <div className="space-y-1.5">
                <Label htmlFor="session-deadline">Deadline</Label>
                <DateTimePicker
                  id="session-deadline"
                  min={new Date()}
                  value={deadline}
                  onChange={setDeadline}
                />
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Classes and Drive folders</legend>
              <p className="text-xs text-muted-foreground">
                Each class creates an independent session. Drive root URLs are optional.
              </p>
              <div className="max-h-72 divide-y divide-border overflow-y-auto border-y border-border">
                {(data?.classes ?? []).map((classRow) => {
                  const checked = selectedClassIds.includes(classRow.id);
                  return (
                    <div
                      key={classRow.id}
                      className="grid gap-3 px-1 py-3 sm:grid-cols-[minmax(10rem,0.45fr)_minmax(0,1fr)] sm:items-center"
                    >
                      <label
                        htmlFor={`session-class-${classRow.id}`}
                        className="flex cursor-pointer items-center gap-3 text-sm"
                      >
                        <Checkbox
                          id={`session-class-${classRow.id}`}
                          checked={checked}
                          onCheckedChange={(value) => toggleClass(classRow.id, value === true)}
                        />
                        <span className="font-medium">{classRow.name}</span>
                        {classRow.id === params.classId ? (
                          <span className="text-xs text-muted-foreground">Current</span>
                        ) : null}
                      </label>
                      {checked ? (
                        <Input
                          type="url"
                          value={driveRootUrls[classRow.id] ?? ""}
                          onChange={(event) =>
                            setDriveRootUrls((current) => ({
                              ...current,
                              [classRow.id]: event.target.value,
                            }))
                          }
                          placeholder={`Optional Drive root URL for ${classRow.name}`}
                          aria-label={`Drive root URL for ${classRow.name}`}
                        />
                      ) : (
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          Select this class to configure its Drive folder.
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedClassIds.length} session{selectedClassIds.length === 1 ? "" : "s"} will be
                created atomically.
              </p>
            </fieldset>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !selectedLabId ||
                !name.trim() ||
                !selectedClassIds.length
              }
            >
              {createMutation.isPending
                ? "Creating…"
                : `Create ${selectedClassIds.length} session${selectedClassIds.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage session</DialogTitle>
            <DialogDescription>
              Update the session or close it to stop new grading writes.
            </DialogDescription>
          </DialogHeader>
          {editDraft ? (
            <div className="grid gap-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editDraft.name}
                  onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-deadline">Deadline</Label>
                <DateTimePicker
                  id="edit-deadline"
                  value={editDraft.deadline}
                  onChange={(value) => setEditDraft({ ...editDraft, deadline: value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-drive">Drive root URL</Label>
                <Input
                  id="edit-drive"
                  type="url"
                  value={editDraft.driveRootUrl}
                  onChange={(event) =>
                    setEditDraft({ ...editDraft, driveRootUrl: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={editDraft.status}
                  onValueChange={(value: GradingSessionStatus) =>
                    setEditDraft({ ...editDraft, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !editDraft?.name.trim()}
            >
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this session?</DialogTitle>
            <DialogDescription>
              Sessions with submissions cannot be deleted. Close them instead to preserve grading
              history.
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
              {deleteMutation.isPending ? "Deleting…" : "Delete session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(scoreEightTarget)}
        onOpenChange={(open) => {
          if (!open && !setScoreEightMutation.isPending) setScoreEightTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set score to 8?</DialogTitle>
            <DialogDescription>
              This will update the latest submission for{" "}
              <strong className="text-foreground">{scoreEightTarget?.student.student_code}</strong>{" "}
              in{" "}
              <strong className="text-foreground">
                {scoreEightTarget?.session.lab_code} - {scoreEightTarget?.session.name}
              </strong>{" "}
              to 8.00 and replace its result details with the set-8 template.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setScoreEightTarget(null)}
              disabled={setScoreEightMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (scoreEightTarget) setScoreEightMutation.mutate(scoreEightTarget);
              }}
              disabled={setScoreEightMutation.isPending || !scoreEightTarget}
            >
              {setScoreEightMutation.isPending ? "Setting…" : "Set score 8"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
