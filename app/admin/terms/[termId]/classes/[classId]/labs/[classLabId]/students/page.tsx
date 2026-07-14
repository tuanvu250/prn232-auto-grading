"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState, Fragment } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Search, CheckCircle2, XCircle, AlertCircle, FileText, Eye, History, ExternalLink, RefreshCw, TriangleAlert, Pencil, Trash2, ChevronDown, ChevronUp, FileJson, FileDown, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/admin/TablePagination";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateStudentSubmissionAction,
  deleteStudentSubmissionAction,
} from "@/lib/actions/erd-admin";
import type { ClassLabStudentResult, ClassLabSubmission, ResubmissionRequestV2, SubmissionStatus } from "@/lib/types/erd";
import { cn } from "@/lib/utils";
import {
  adminClassLabStudentsQueryOptions,
  adminClassLabSubmissionsQueryOptions,
  adminQueryKeys,
  adminStudentDetailsQueryOptions,
} from "@/lib/queries/admin";

function statusBadge(status: string | null) {
  if (!status) return <Badge variant="outline" className="font-medium">Not submitted</Badge>;
  if (status === "passed")
    return <Badge className="border-none bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 font-bold">Passed</Badge>;
  if (status === "failed")
    return <Badge className="border-none bg-red-500/10 text-red-600 hover:bg-red-500/10 font-bold">Failed</Badge>;
  return <Badge className="border-none bg-amber-500/10 text-amber-600 hover:bg-amber-500/10 font-bold">Grading</Badge>;
}

function itemTypeBadge(itemType: string) {
  if (itemType === "resubmit") return <Badge variant="outline" className="text-[10px] font-mono">Resubmit</Badge>;
  if (itemType === "late") return <Badge variant="outline" className="text-[10px] font-mono">Late</Badge>;
  return <Badge variant="outline" className="text-[10px] font-mono">Original</Badge>;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
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

function getMethodBadgeColor(method: string): string {
  const m = method.toUpperCase();
  if (m === "GET") return "bg-[#61aff6] text-white dark:bg-[#489bed]";
  if (m === "POST") return "bg-[#49cc90] text-white dark:bg-[#3dbb7f]";
  if (m === "PUT") return "bg-[#fca130] text-white dark:bg-[#e58e26]";
  if (m === "DELETE") return "bg-[#f93e3e] text-white dark:bg-[#e52d2d]";
  if (m === "PATCH") return "bg-[#50e3c2] text-white dark:bg-[#3cd1b0]";
  if (m === "SOURCE") return "bg-[#9012fe] text-white dark:bg-[#7a0ce3]";
  return "bg-muted text-muted-foreground";
}

function getStatusCodeBadgeColor(code: number): string {
  if (code >= 200 && code < 300) return "bg-emerald-50 text-emerald-600 border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
  if (code >= 300 && code < 400) return "bg-blue-50 text-blue-600 border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
  if (code >= 400 && code < 500) return "bg-amber-50 text-amber-600 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
  if (code >= 500) return "bg-rose-50 text-rose-600 border-rose-200/80 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
  return "bg-muted text-muted-foreground border-border/50";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getExcelSafeFilename(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_") || "export";
}

function getAttemptTestSummary(submission: ClassLabSubmission) {
  const tests = submission.details?.results || submission.details?.tests || [];
  if (tests.length === 0) {
    return { passed: "", total: "", summary: "" };
  }

  const passed = tests.filter((test) => test.passed).length;
  return {
    passed,
    total: tests.length,
    summary: `${passed}/${tests.length}`,
  };
}

export default function AdminClassLabStudentsPage() {
  const params = useParams<{ termId: string; classId: string; classLabId: string }>();
  const queryClient = useQueryClient();
  const resultsQueryOptions = adminClassLabStudentsQueryOptions(
    params.termId,
    params.classId,
    params.classLabId
  );
  const { data, error, isPending: loading } = useQuery(resultsQueryOptions);
  const results = data?.results ?? [];
  const termName = data?.termName ?? "Term";
  const className = data?.className ?? "Class";
  const labCode = data?.labCode ?? "Lab";
  const labDriveRootUrl = data?.labDriveRootUrl ?? "";

  // States cho Search và Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);

  // Phân trang client-side
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // States cho Dialog xem chi tiết submission & resubmission requests
  const [selectedStudent, setSelectedStudent] = useState<ClassLabStudentResult | null>(null);
  const [submissions, setSubmissions] = useState<ClassLabSubmission[]>([]);
  const [resubmissions, setResubmissions] = useState<ResubmissionRequestV2[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"submission" | "requests">("submission");
  const [expandedTests, setExpandedTests] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setExpandedTests({});
  }, [selectedAttemptId]);

  const toggleTestExpanded = (idx: number) => {
    setExpandedTests(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const refreshResults = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.classLabStudents(
        params.termId,
        params.classId,
        params.classLabId
      ),
    });
    return queryClient.fetchQuery(
      adminClassLabStudentsQueryOptions(params.termId, params.classId, params.classLabId)
    );
  }, [params.classId, params.classLabId, params.termId, queryClient]);

  const fetchStudentDetails = useCallback(
    async (student: ClassLabStudentResult) =>
      queryClient.fetchQuery(
        adminStudentDetailsQueryOptions(
          params.termId,
          params.classId,
          params.classLabId,
          student.class_student_id,
          student.attempt_count > 0
        )
      ),
    [params.classId, params.classLabId, params.termId, queryClient]
  );

  const handleViewDetails = useCallback(async (student: ClassLabStudentResult, keepSelectedAttemptId?: string | null) => {
    setSelectedStudent(student);
    setActiveTab("submission");
    const detailOptions = adminStudentDetailsQueryOptions(
      params.termId,
      params.classId,
      params.classLabId,
      student.class_student_id,
      student.attempt_count > 0
    );
    const cached = queryClient.getQueryData<{
      submissions: ClassLabSubmission[];
      resubmissions: ResubmissionRequestV2[];
    }>(detailOptions.queryKey);
    if (cached) {
      setSubmissions(cached.submissions);
      setResubmissions(cached.resubmissions);
    } else {
      setSubmissions([]);
      setResubmissions([]);
    }
    setDetailLoading(!cached);
    try {
      const { submissions: subs, resubmissions: resubs } = await fetchStudentDetails(student);
      setSubmissions(subs);
      setResubmissions(resubs);
      if (subs && subs.length > 0) {
        const hasStill = keepSelectedAttemptId && subs.some(s => s.id === keepSelectedAttemptId);
        setSelectedAttemptId(hasStill ? keepSelectedAttemptId : subs[0].id);
      } else {
        setSelectedAttemptId(null);
      }
    } catch (err) {
      console.error("Failed to load details for student:", err);
      toast.error("Unable to load details.");
    } finally {
      setDetailLoading(false);
    }
  }, [fetchStudentDetails, params.classId, params.classLabId, params.termId, queryClient]);

  // States cho Edit Submission
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSubmission, setEditSubmission] = useState<ClassLabSubmission | null>(null);
  const [editStudentCode, setEditStudentCode] = useState("");
  const [editScore, setEditScore] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<"passed" | "failed" | "grading">("grading");
  const [editSourceUrl, setEditSourceUrl] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // States cho Delete Submission
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteSubmissionId, setDeleteSubmissionId] = useState<string | null>(null);
  const [deleteStudentCode, setDeleteStudentCode] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenEdit = useCallback((studentCode: string, sub: ClassLabSubmission) => {
    setEditSubmission(sub);
    setEditStudentCode(studentCode);
    setEditScore(sub.score !== null ? Number(sub.score) : 0);
    setEditStatus(sub.status as SubmissionStatus);
    setEditSourceUrl(sub.source_url || "");
    setIsEditOpen(true);
  }, []);

  const handleOpenDelete = useCallback((studentCode: string, submissionId: string) => {
    setDeleteSubmissionId(submissionId);
    setDeleteStudentCode(studentCode);
    setIsDeleteOpen(true);
  }, []);

  const handleSaveEdit = async () => {
    if (!editSubmission) return;
    setIsSavingEdit(true);
    try {
      await updateStudentSubmissionAction(editSubmission.id, {
        score: editScore,
        status: editStatus,
        sourceUrl: editSourceUrl,
      });
      toast.success("Submission updated successfully!");
      setIsEditOpen(false);

      // Reload danh sách ngoài
      await refreshResults();

      // Cập nhật lại Dialog chi tiết nếu đang mở
      if (selectedStudent) {
        await handleViewDetails(selectedStudent, selectedAttemptId);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update submission."));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteSubmissionId) return;
    setIsDeleting(true);
    try {
      await deleteStudentSubmissionAction(deleteSubmissionId);
      toast.success("Submission deleted successfully!");
      setIsDeleteOpen(false);

      // Reload danh sách ngoài
      const refreshed = await refreshResults();

      // Cập nhật lại Dialog chi tiết nếu đang mở
      if (selectedStudent) {
        const updatedStudent = refreshed.results.find(
          (row) => row.class_student_id === selectedStudent.class_student_id
        );
        if (updatedStudent) {
          await handleViewDetails(updatedStudent, null);
        } else {
          setSelectedStudent(null);
        }
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete submission."));
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!error) return;
    console.error("Failed to load student results:", error);
    toast.error("Unable to load student results.");
  }, [error]);

  // Reset trang khi bộ lọc thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Bộ lọc dữ liệu client-side
  const filteredResults = results.filter((row) => {
    const matchesSearch =
      row.student_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (row.student_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.student_email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "passed" && row.latest_status === "passed") ||
      (statusFilter === "failed" && row.latest_status === "failed") ||
      (statusFilter === "grading" && row.latest_status === "grading") ||
      (statusFilter === "not_submitted" && !row.latest_status);

    return matchesSearch && matchesStatus;
  });

  // Tính toán dữ liệu phân trang
  const total = filteredResults.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedResults = filteredResults.slice(startIndex, startIndex + pageSize);

  // Tính toán thống kê nhanh
  const totalCount = results.length;
  const passedCount = results.filter((r) => r.latest_status === "passed").length;
  const failedCount = results.filter((r) => r.latest_status === "failed").length;
  const gradingCount = results.filter((r) => r.latest_status === "grading").length;
  const notSubmittedCount = results.filter((r) => !r.latest_status).length;

  const handleExportExcel = async () => {
    if (filteredResults.length === 0) {
      toast.error("No student rows to export.");
      return;
    }

    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const allSubmissions = await queryClient.fetchQuery(
        adminClassLabSubmissionsQueryOptions(params.termId, params.classId, params.classLabId)
      );
      const filteredStudentIds = new Set(filteredResults.map((row) => row.class_student_id));
      const studentById = new Map(filteredResults.map((row) => [row.class_student_id, row]));
      const exportSubmissions = allSubmissions.filter((submission) =>
        filteredStudentIds.has(submission.class_student_id)
      );

      const summaryRows = filteredResults.map((row) => ({
        "Student Code": row.student_code,
        "Full Name": row.student_name || "",
        Email: row.student_email,
        Term: termName,
        Class: className,
        Lab: labCode,
        "Attempt Count": row.attempt_count,
        "Resubmit Count": row.resubmit_count,
        "Latest Attempt": row.latest_attempt_no ?? "",
        "Latest Score": row.latest_score ?? "",
        "Latest Status": row.latest_status ?? "not_submitted",
      }));

      const attemptRows = exportSubmissions.map((submission) => {
        const student = studentById.get(submission.class_student_id);
        const testSummary = getAttemptTestSummary(submission);

        return {
          "Student Code": student?.student_code || "",
          "Full Name": student?.student_name || "",
          Email: student?.student_email || "",
          Term: termName,
          Class: className,
          Lab: labCode,
          "Attempt No": submission.attempt_no,
          Type: submission.item_type,
          Score: submission.score ?? "",
          Status: submission.status,
          "Passed Tests": testSummary.passed,
          "Total Tests": testSummary.total,
          "Test Summary": testSummary.summary,
          "Source URL": submission.source_url || "",
          "Submitted At": submission.submitted_at,
          "Graded At": submission.graded_at || "",
          "Submission ID": submission.id,
        };
      });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Student Summary");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(attemptRows), "Submission Attempts");

      const statusSuffix = statusFilter === "all" ? "all" : statusFilter;
      const fileName = getExcelSafeFilename(
        `${termName || "Term"}_${className || "Class"}_${labCode || "Lab"}_${statusSuffix}_submissions.xlsx`
      );

      XLSX.writeFile(workbook, fileName);
      toast.success(`Exported ${summaryRows.length} students and ${attemptRows.length} attempts.`);
    } catch (err) {
      console.error("Failed to export submissions:", err);
      toast.error(getErrorMessage(err, "Failed to export Excel file."));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-6 p-4 sm:p-6 lg:px-8 lg:pb-4 lg:pt-6">
      <AdminPageHeader
        breadcrumbs={[
          { label: "Terms", href: "/admin/terms" },
          { label: termName || "Loading...", href: `/admin/terms/${params.termId}/classes` },
          { label: className || "Loading...", href: `/admin/terms/${params.termId}/classes/${params.classId}/labs` },
          { label: labCode || "Loading..." },
          { label: "Students" },
        ]}
        title={`Student Results for ${labCode || "Loading..."}`}
        description="Monitor scores, check submission attempts and control resubmission statuses."
        backHref={`/admin/terms/${params.termId}/classes/${params.classId}/labs`}
        actions={
          <>
            {labDriveRootUrl ? (
              <Button
                size="sm"
                className="bg-emerald-600 text-white shadow-none hover:bg-emerald-700"
                asChild
              >
                <a
                  href={labDriveRootUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open Drive folder for ${labCode || "this lab"}`}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Open Drive
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportExcel}
              disabled={loading || isExporting || filteredResults.length === 0}
              className="shadow-none"
            >
              {isExporting ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Export Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshResults()}
              className="shadow-none"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </>
        }
      />

      {/* Thẻ thống kê tổng quan */}
      {loading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card
              key={i}
              className="p-4 bg-card border border-border shadow-none rounded-lg flex items-center gap-3"
            >
              <Skeleton className="h-8 w-8 rounded" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-5 w-1/3" />
              </div>
            </Card>
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <Card className="p-4 bg-card border border-border shadow-none rounded-lg flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
              <Users className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Enrolled</p>
              <p className="text-lg font-bold font-mono">{totalCount}</p>
            </div>
          </Card>
          <Card className="p-4 bg-card border border-border shadow-none rounded-lg flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Passed</p>
              <p className="text-lg font-bold font-mono text-emerald-600">{passedCount}</p>
            </div>
          </Card>
          <Card className="p-4 bg-card border border-border shadow-none rounded-lg flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-red-500/10 text-red-600">
              <XCircle className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Failed</p>
              <p className="text-lg font-bold font-mono text-red-600">{failedCount}</p>
            </div>
          </Card>
          <Card className="p-4 bg-card border border-border shadow-none rounded-lg flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-500/10 text-amber-600">
              <AlertCircle className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Grading</p>
              <p className="text-lg font-bold font-mono text-amber-600">{gradingCount}</p>
            </div>
          </Card>
          <Card className="p-4 bg-card border border-border shadow-none rounded-lg flex items-center gap-3 col-span-2 lg:col-span-1">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground">
              <FileText className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Not Submitted</p>
              <p className="text-lg font-bold font-mono text-muted-foreground">{notSubmittedCount}</p>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Bộ lọc và ô tìm kiếm */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search student code, name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 shadow-none border-border focus-visible:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Filter Status:</span>
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >
            <SelectTrigger className="h-9 w-[150px] rounded-md shadow-none border-border focus:ring-primary">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="grading">Grading</SelectItem>
              <SelectItem value="not_submitted">Not Submitted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bảng kết quả */}
      <div className="flex flex-1 flex-col gap-4">
        {loading ? (
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <div className="p-4 border-b border-border bg-muted/20 flex gap-4">
              <Skeleton className="h-4 w-1/6" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16 ml-auto" />
            </div>
            <div className="divide-y divide-border/60">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4 flex gap-4 items-center">
                  <Skeleton className="h-4 w-1/6" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        ) : filteredResults.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground border border-dashed shadow-none rounded-xl">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
            <p className="font-medium text-foreground mb-1">No students found</p>
            <p className="text-xs text-muted-foreground">
              {results.length === 0
                ? "No students enrolled in this class yet."
                : "No student matches the search or filter criteria."}
            </p>
          </Card>
        ) : (
          <div className="flex flex-1 flex-col gap-4">
            <Card className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border shadow-none">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className="font-semibold text-xs text-muted-foreground tracking-wider">Student Code</TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground tracking-wider">Full Name</TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground tracking-wider">Email</TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground tracking-wider text-center">Attempts</TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground tracking-wider text-center">Resubmits</TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground tracking-wider text-right">Latest Score</TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground tracking-wider pl-6">Status</TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground tracking-wider text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedResults.map((row) => (
                      <TableRow
                        key={row.class_student_id}
                        className="hover:bg-muted/10 border-b border-border/60 transition-colors cursor-pointer"
                        onClick={() => handleViewDetails(row)}
                      >
                        <TableCell className="font-semibold font-mono text-sm tracking-tight text-foreground">
                          {row.student_code}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {row.student_name || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {row.student_email}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm">
                          {row.attempt_count}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={row.resubmit_count > 0 ? "default" : "outline"} className="font-mono text-[10px]">
                            {row.resubmit_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-sm text-foreground">
                          {row.latest_score !== null ? row.latest_score.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="pl-6">{statusBadge(row.latest_status)}</TableCell>
                        <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => handleViewDetails(row)}
                              title="View details"
                            >
                              <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              <span className="sr-only">View details</span>
                            </Button>
                            {row.attempt_count > 0 && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={async () => {
                                    try {
                                      const { submissions: subs } = await fetchStudentDetails(row);
                                      if (subs && subs.length > 0) {
                                        handleOpenEdit(row.student_code, subs[0]);
                                      } else {
                                        toast.error("No submission found to edit.");
                                      }
                                    } catch {
                                      toast.error("Failed to load submission data.");
                                    }
                                  }}
                                  title="Edit latest submission"
                                >
                                  <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                  <span className="sr-only">Edit latest submission</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={async () => {
                                    try {
                                      const { submissions: subs } = await fetchStudentDetails(row);
                                      if (subs && subs.length > 0) {
                                        handleOpenDelete(row.student_code, subs[0].id);
                                      } else {
                                        toast.error("No submission found to delete.");
                                      }
                                    } catch {
                                      toast.error("Failed to load submission data.");
                                    }
                                  }}
                                  title="Delete latest submission"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete latest submission</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
            <TablePagination
              pagination={{
                page: currentPage,
                pageSize: pageSize,
                total: total,
                totalPages: totalPages,
              }}
              loading={loading}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      <Dialog open={selectedStudent !== null} onOpenChange={(open) => { if (!open) setSelectedStudent(null); }}>
        <DialogContent className="w-[70vw] max-w-[95vw] max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-card">
            <DialogTitle className="text-xl font-bold flex items-center justify-between">
              <span>Result Details: {selectedStudent?.student_code}</span>
            </DialogTitle>
            <DialogDescription className="text-sm">
              Full Name: <span className="font-semibold text-foreground">{selectedStudent?.student_name || "—"}</span> | Email: <span className="font-semibold text-foreground">{selectedStudent?.student_email}</span>
            </DialogDescription>
            
            {/* Tabs Selector */}
            <div className="flex gap-4 mt-4 border-b border-border">
              <button
                className={`pb-2 px-1 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === "submission"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("submission")}
              >
                Attempts ({submissions.length})
              </button>
              <button
                className={`pb-2 px-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === "requests"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("requests")}
              >
                <History className="h-3.5 w-3.5" />
                Request History ({resubmissions.length})
              </button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                <span>Loading details...</span>
              </div>
            ) : activeTab === "submission" ? (
              // TAB 1: SUBMISSION DETAILS
              submissions.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <AlertCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <span>This student has not submitted this lab yet.</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Table lists all attempts */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      All Attempts
                    </h3>
                    <div className="border border-border rounded-lg overflow-hidden bg-card">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow className="h-8">
                            <TableHead className="text-xs font-semibold py-1.5 h-8">Attempt</TableHead>
                            <TableHead className="text-xs font-semibold py-1.5 h-8">Type</TableHead>
                            <TableHead className="text-xs font-semibold py-1.5 h-8 text-right">Score</TableHead>
                            <TableHead className="text-xs font-semibold py-1.5 h-8">Status</TableHead>
                            <TableHead className="text-xs font-semibold py-1.5 h-8">Submitted At</TableHead>
                            <TableHead className="text-xs font-semibold py-1.5 h-8 text-right pr-4">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {submissions.map((sub) => {
                            const isSelected = sub.id === selectedAttemptId;
                            return (
                              <TableRow
                                key={sub.id}
                                className={cn(
                                  "cursor-pointer transition-colors text-xs h-9",
                                  isSelected ? "bg-primary/5 hover:bg-primary/5 font-semibold" : "hover:bg-muted/40"
                                )}
                                onClick={() => setSelectedAttemptId(sub.id)}
                              >
                                <TableCell className="py-2.5 font-bold">
                                  #{sub.attempt_no}
                                </TableCell>
                                <TableCell className="py-2.5">
                                  {itemTypeBadge(sub.item_type)}
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-mono font-bold text-foreground">
                                  {sub.score !== null ? sub.score.toFixed(2) : "—"}
                                </TableCell>
                                <TableCell className="py-2.5">
                                  {statusBadge(sub.status)}
                                </TableCell>
                                <TableCell className="py-2.5 text-muted-foreground">
                                  {formatDate(sub.submitted_at)}
                                </TableCell>
                                <TableCell className="py-2.5 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex justify-end gap-1">
                                    {sub.source_url && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                        asChild
                                        title="Open Drive link"
                                      >
                                        <a href={sub.source_url} target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      </Button>
                                    )}
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                      onClick={() => handleOpenEdit(selectedStudent?.student_code || "", sub)}
                                      title="Edit this attempt"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleOpenDelete(selectedStudent?.student_code || "", sub.id)}
                                      title="Delete this attempt"
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
                  </div>

                  {/* Diagnostic logs section */}
                  {(() => {
                    const selectedSub = submissions.find(s => s.id === selectedAttemptId) || submissions[0];
                    if (!selectedSub) return null;
                    const buildLogs = selectedSub.details?.build_logs || selectedSub.details?.buildLogs;
                    const tests = selectedSub.details?.results || selectedSub.details?.tests || [];
                    const isErrorBuild =
                      !!buildLogs &&
                      /error|failed|exception/i.test(buildLogs) &&
                      !buildLogs.includes("Build succeeded");
                    
                    return (
                      <div className="space-y-5 pt-4 border-t border-border/60">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            Diagnostic details: Attempt #{selectedSub.attempt_no}
                          </h3>
                          {selectedSub.graded_at && (
                            <span className="text-[10px] text-muted-foreground">
                              Graded at: {formatDate(selectedSub.graded_at)}
                            </span>
                          )}
                        </div>

                        {/* Build Diagnostic Logs */}
                        {buildLogs ? (
                          <div className="space-y-2">
                            <h4
                              className={`flex items-center gap-1.5 text-xs font-bold ${
                                isErrorBuild ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {isErrorBuild ? <TriangleAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                              Build Diagnostic Logs
                            </h4>
                            <div
                              className={`rounded-lg border p-4 ${
                                isErrorBuild
                                  ? "border-red-200 bg-red-50/50 dark:border-red-950/30 dark:bg-red-950/10"
                                  : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-950/30 dark:bg-emerald-950/10"
                              }`}
                            >
                              <pre className="max-h-40 overflow-y-auto overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
                                {buildLogs}
                              </pre>
                            </div>
                          </div>
                        ) : null}

                        {/* Testcases table */}
                        {tests.length > 0 ? (
                          (() => {
                            const hasApiDetails = tests.some((tc) => tc.httpMethod || tc.method || tc.urlTemplate || tc.url || tc.actualStatusCode !== undefined || tc.statusCode !== undefined);
                            return (
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold text-foreground">
                                  Testcase Results ({tests.filter(t => t.passed).length}/{tests.length})
                                </h4>
                                <Card className="overflow-hidden border border-border shadow-none rounded-lg">
                                  <Table>
                                    <TableHeader className="bg-muted/30">
                                      <TableRow>
                                        {hasApiDetails ? (
                                          <>
                                            <TableHead className="h-9 text-xs w-[90px]">Method</TableHead>
                                            <TableHead className="h-9 text-xs">Endpoint / Check</TableHead>
                                            <TableHead className="h-9 text-xs w-[110px] text-center">Status</TableHead>
                                            <TableHead className="h-9 text-xs w-[110px] text-center">Result</TableHead>
                                            <TableHead className="h-9 text-xs w-[120px] text-right">Score</TableHead>
                                            <TableHead className="h-9 text-xs w-[50px]"></TableHead>
                                          </>
                                        ) : (
                                          <>
                                            <TableHead className="h-9 text-xs">Testcase</TableHead>
                                            <TableHead className="h-9 text-xs w-[110px] text-center">Result</TableHead>
                                            <TableHead className="h-9 text-xs w-[110px] text-right">Score</TableHead>
                                            <TableHead className="h-9 text-xs w-[50px]"></TableHead>
                                          </>
                                        )}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {tests.map((tc, idx) => {
                                        const isPassed = tc.passed;
                                        const method = tc.httpMethod || tc.method;
                                        const url = tc.urlTemplate || tc.url || tc.name;
                                        const statusCode = tc.actualStatusCode ?? tc.statusCode ?? tc.actual_status_code;
                                        const responseVal = tc.actualResponse || tc.actual_response;
                                        const err = tc.errorMessage || tc.error;
                                        const hasOverride = tc.manualOverrideScore !== null && tc.manualOverrideScore !== undefined;
                                        const scoreToDisplay = hasOverride ? tc.manualOverrideScore : (tc.effectiveScore ?? tc.awardedScore ?? tc.score);
                                        const hasDetails = !!(err || responseVal || tc.overrideReason);
                                        const isExpanded = !!expandedTests[idx];
                                        return (
                                          <Fragment key={idx}>
                                            <TableRow 
                                               key={idx} 
                                               className={`transition-colors ${hasDetails ? "cursor-pointer hover:bg-muted/10" : "hover:bg-muted/5"} border-b border-border/50`}
                                               onClick={() => { if (hasDetails) toggleTestExpanded(idx); }}
                                            >
                                              {hasApiDetails ? (
                                                <>
                                                  <TableCell className="py-2.5">
                                                    {method ? (
                                                      <span className={`inline-flex items-center justify-center font-mono font-bold text-[10px] uppercase rounded-[3px] w-[66px] py-0.5 select-none ${getMethodBadgeColor(method)}`}>
                                                        {method}
                                                      </span>
                                                    ) : (
                                                      <span className="text-muted-foreground">—</span>
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="py-2.5">
                                                    <div className="font-mono text-xs font-medium text-foreground select-all break-all">
                                                      {url || "—"}
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="py-2.5 text-center">
                                                    {statusCode !== undefined && statusCode !== null ? (
                                                      <span className={`inline-flex items-center justify-center font-mono font-semibold text-[11px] px-2.5 py-0.5 rounded-full border select-none ${getStatusCodeBadgeColor(statusCode)}`}>
                                                        {statusCode}
                                                      </span>
                                                    ) : (
                                                      <span className="text-muted-foreground">—</span>
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="py-2.5 text-center">
                                                    {isPassed ? (
                                                      <Badge className="bg-emerald-500 hover:bg-emerald-500/90 text-white font-medium text-[11px] px-2.5 py-0.5 border-none">
                                                        ✓ Pass
                                                      </Badge>
                                                    ) : (
                                                      <Badge variant="destructive" className="font-medium text-[11px] px-2.5 py-0.5">
                                                        ✗ Fail
                                                      </Badge>
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="py-2.5 text-right font-mono text-xs">
                                                    {hasOverride ? (
                                                      <span className="space-x-1" title="Teacher Overridden">
                                                        <span className="line-through text-muted-foreground text-[10px]">
                                                          {(tc.awardedScore ?? tc.score ?? 0).toFixed(1)}
                                                        </span>
                                                        <span className="font-bold text-amber-600 dark:text-amber-400">
                                                          {scoreToDisplay !== undefined && scoreToDisplay !== null ? scoreToDisplay.toFixed(1) : "—"}
                                                        </span>
                                                      </span>
                                                    ) : tc.effectiveScore !== undefined && tc.awardedScore !== undefined ? (
                                                      tc.effectiveScore === tc.awardedScore ? (
                                                        <span className="font-bold text-foreground">{tc.effectiveScore.toFixed(1)}</span>
                                                      ) : (
                                                        <span className="space-x-1" title="Effective / Raw">
                                                          <span className="font-bold text-foreground">{tc.effectiveScore.toFixed(1)}</span>
                                                          <span className="text-[10px] text-muted-foreground">({tc.awardedScore.toFixed(1)})</span>
                                                        </span>
                                                      )
                                                    ) : (
                                                      <span className="font-bold text-foreground">
                                                        {scoreToDisplay !== undefined && scoreToDisplay !== null ? scoreToDisplay.toFixed(1) : (isPassed ? "1.0" : "0.0")}
                                                      </span>
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="py-2.5 text-center">
                                                    {hasDetails ? (
                                                      <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-6 w-6"
                                                        onClick={(e) => { e.stopPropagation(); toggleTestExpanded(idx); }}
                                                      >
                                                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                      </Button>
                                                    ) : null}
                                                  </TableCell>
                                                </>
                                              ) : (
                                                <>
                                                  <TableCell className="py-2.5">
                                                    <div className="text-xs text-foreground font-medium" title={url}>
                                                      {url}
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="py-2.5 text-center">
                                                    {isPassed ? (
                                                      <Badge className="bg-emerald-500 hover:bg-emerald-500/90 text-white font-medium text-[11px] px-2.5 py-0.5 border-none">
                                                        ✓ Pass
                                                      </Badge>
                                                    ) : (
                                                      <Badge variant="destructive" className="font-medium text-[11px] px-2.5 py-0.5">
                                                        ✗ Fail
                                                      </Badge>
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="py-2.5 text-right font-mono text-xs">
                                                    {hasOverride ? (
                                                      <span className="space-x-1" title="Teacher Overridden">
                                                        <span className="line-through text-muted-foreground text-[10px]">
                                                          {(tc.awardedScore ?? tc.score ?? 0).toFixed(1)}
                                                        </span>
                                                        <span className="font-bold text-amber-600 dark:text-amber-400">
                                                          {scoreToDisplay !== undefined && scoreToDisplay !== null ? scoreToDisplay.toFixed(1) : "—"}
                                                        </span>
                                                      </span>
                                                    ) : (
                                                      <span className="font-bold text-foreground">
                                                        {scoreToDisplay !== undefined && scoreToDisplay !== null ? scoreToDisplay.toFixed(1) : (isPassed ? "1.0" : "0.0")}
                                                      </span>
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="py-2.5 text-center">
                                                    {hasDetails ? (
                                                      <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-6 w-6"
                                                        onClick={(e) => { e.stopPropagation(); toggleTestExpanded(idx); }}
                                                      >
                                                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                      </Button>
                                                    ) : null}
                                                  </TableCell>
                                                </>
                                              )}
                                            </TableRow>

                                            {isExpanded && hasDetails ? (
                                              <TableRow key={`exp-${idx}`} className="bg-muted/10 hover:bg-muted/10 border-b border-border/50">
                                                <TableCell colSpan={hasApiDetails ? 6 : 4} className="py-3 px-5">
                                                  <div className="space-y-2.5">
                                                    {err ? (
                                                      <div className="rounded-lg border border-red-200 bg-red-500/5 p-3 text-xs leading-relaxed text-red-600 dark:border-red-950/30 dark:text-red-400">
                                                        <div className="flex items-start gap-2">
                                                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                          <div>
                                                            <p className="font-bold mb-0.5">Error Message:</p>
                                                            <pre className="font-mono text-[11px] whitespace-pre-wrap">{err}</pre>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    ) : null}
                                                    {tc.overrideReason ? (
                                                      <div className="rounded-lg border border-amber-200 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-700 dark:border-amber-950/30 dark:text-amber-400">
                                                        <div className="flex items-start gap-2">
                                                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                          <div>
                                                            <p className="font-bold mb-0.5">Override Reason:</p>
                                                            <p className="font-sans italic">{tc.overrideReason}</p>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    ) : null}
                                                    {responseVal ? (
                                                      <div className="space-y-1">
                                                        <p className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                                                          <FileJson className="h-3.5 w-3.5" /> Actual Response / Output
                                                        </p>
                                                        <div className="overflow-hidden rounded-lg border border-border bg-card">
                                                          <pre className="max-h-48 overflow-y-auto max-w-full overflow-x-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed text-foreground select-all">
                                                            {formatResponse(responseVal)}
                                                          </pre>
                                                        </div>
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
                                </Card>
                              </div>
                            );
                          })()
                        ) : !buildLogs ? (
                          <div className="text-center py-6 text-xs text-muted-foreground bg-muted/10 border border-dashed rounded-lg">
                            No test case result details available.
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              )
            ) : (
              // TAB 2: RESUBMISSION HISTORY
              resubmissions.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <History className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <span>No resubmission requests for this lab yet.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {resubmissions.map((req) => (
                    <div key={req.id} className="p-4 border border-border rounded-lg bg-card space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              req.status === "pending"
                                ? "border-none bg-amber-500/10 text-amber-600 hover:bg-amber-500/10 font-bold"
                                : req.status === "approved"
                                  ? "border-none bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 font-bold"
                                  : req.status === "completed"
                                    ? "border-none bg-sky-500/10 text-sky-600 hover:bg-sky-500/10 font-bold"
                                    : "border-none bg-red-500/10 text-red-600 hover:bg-red-500/10 font-bold"
                            }
                          >
                            {req.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Created at: {formatDate(req.created_at)}
                          </span>
                        </div>
                        {req.drive_link && (
                          <a
                            href={req.drive_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> Resubmitted Link
                          </a>
                        )}
                      </div>

                      <div className="text-xs space-y-1 text-muted-foreground">
                        <p>
                          Student Note: <span className="text-foreground italic">{req.note || "—"}</span>
                        </p>
                        {req.admin_note && (
                          <div className="p-2 border border-amber-200/50 bg-amber-500/5 dark:border-amber-950/30 dark:bg-amber-950/10 rounded text-foreground">
                            Teacher Feedback: <span className="font-medium text-amber-700 dark:text-amber-300">{req.admin_note}</span>
                          </div>
                        )}
                        {req.completed_at && (
                          <p className="text-[11px] text-muted-foreground/80 mt-1">
                            Processed at {formatDate(req.completed_at)} by {req.completed_by || "System"}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
          
          <div className="p-4 border-t border-border bg-muted/10 flex justify-end">
            <Button variant="outline" className="shadow-none" onClick={() => setSelectedStudent(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Submission Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Edit Submission: {editStudentCode}</DialogTitle>
            <DialogDescription className="text-sm">
              Modify the score, status, and source Drive URL for this student attempt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground block">
                Score (out of 10.00)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={editScore}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setEditScore(isNaN(val) ? 0 : val);
                  if (!isNaN(val)) {
                    // Gợi ý status dựa vào score
                    setEditStatus(val >= 5 ? "passed" : "failed");
                  }
                }}
                className="focus-visible:ring-primary shadow-none border-border"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground block">
                Status
              </label>
              <Select
                value={editStatus}
                onValueChange={(value) => setEditStatus(value as SubmissionStatus)}
              >
                <SelectTrigger className="w-full rounded-md shadow-none border-border focus:ring-primary">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="grading">Grading</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground block">
                Source Drive Link
              </label>
              <Input
                type="text"
                value={editSourceUrl}
                onChange={(e) => setEditSourceUrl(e.target.value)}
                className="focus-visible:ring-primary shadow-none border-border"
                placeholder="https://drive.google.com/..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" className="shadow-none" onClick={() => setIsEditOpen(false)} disabled={isSavingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit} className="shadow-none">
              {isSavingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-card border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This action will permanently delete the latest submission attempt of student <span className="font-semibold text-foreground">{deleteStudentCode}</span>.
              <br />
              <br />
              <span className="text-red-500 font-semibold">Warning:</span> All resubmission requests associated with this attempt will also be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel disabled={isDeleting} className="shadow-none border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700 shadow-none"
            >
              {isDeleting ? "Deleting..." : "Delete Submission"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
