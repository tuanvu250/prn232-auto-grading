"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { toast } from "sonner";
import {
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  KeyRound,
  LogOut,
  Pencil,
  RefreshCw,
  Trash2,
  UploadCloud,
  User as UserIcon,
  Users,
  ChevronsLeft,
  ChevronsRight,
  XCircle,
} from "lucide-react";

import { useDebounce } from "@/hooks/useDebounce";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_ADMIN } from "@/lib/types/roles";
import { removeAuthCookie, UserPayload } from "@/lib/utils/auth";

type AdminView = "resubmissions" | "studentAccess";

interface ResubmissionRequest {
  id: string;
  student_id: string;
  email: string;
  name?: string | null;
  class_name?: string | null;
  lab_id: string;
  drive_link: string;
  note?: string | null;
  admin_note?: string | null;
  status: "pending" | "approved" | "rejected" | "completed";
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  completed_by?: string | null;
}

interface AllowedEmail {
  email: string;
  student_id: string;
  class_name: string;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ResubmissionSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
}

interface AccessSummary {
  total: number;
  classes: number;
}

const emptyAccessForm = {
  email: "",
  studentId: "",
  className: "",
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return dateStr;
  }
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserPayload | null>(null);
  const [activeView, setActiveView] = useState<AdminView>("resubmissions");

  const [requests, setRequests] = useState<ResubmissionRequest[]>([]);
  const [requestStatus, setRequestStatus] = useState("pending");
  const [requestQuery, setRequestQuery] = useState("");
  const debouncedRequestQuery = useDebounce(requestQuery, 400);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ResubmissionRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [requestPagination, setRequestPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [requestSummary, setRequestSummary] = useState<ResubmissionSummary>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    completed: 0,
  });

  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [accessQuery, setAccessQuery] = useState("");
  const debouncedAccessQuery = useDebounce(accessQuery, 400);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AllowedEmail | null>(null);
  const [accessForm, setAccessForm] = useState(emptyAccessForm);
  const [accessPagination, setAccessPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [accessSummary, setAccessSummary] = useState<AccessSummary>({
    total: 0,
    classes: 0,
  });

  useEffect(() => {
    const token = Cookies.get("authToken");
    if (!token) {
      router.push("/");
      return;
    }

    try {
      const decoded = jwtDecode<UserPayload>(token);
      if (decoded.role !== ROLE_ADMIN) {
        router.push("/student/dashboard");
        return;
      }
      setUser(decoded);
    } catch {
      toast.error("Invalid session. Please sign in again.");
      removeAuthCookie();
      router.push("/");
    }
  }, [router]);

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const params = new URLSearchParams();
      params.set("status", requestStatus);
      params.set("page", String(requestPagination.page));
      params.set("pageSize", String(requestPagination.pageSize));
      if (debouncedRequestQuery.trim()) params.set("q", debouncedRequestQuery.trim());

      const res = await fetch(`/api/admin/resubmissions?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error || "Unable to load requests.");
        return;
      }

      setRequests(json.data || []);
      setRequestPagination(json.pagination || requestPagination);
      setRequestSummary(json.summary || requestSummary);
    } catch (err) {
      console.error("Failed to load resubmissions:", err);
      toast.error("Unable to reach the server.");
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchAllowedEmails = async () => {
    setLoadingAccess(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(accessPagination.page));
      params.set("pageSize", String(accessPagination.pageSize));
      if (debouncedAccessQuery.trim()) params.set("q", debouncedAccessQuery.trim());

      const res = await fetch(`/api/admin/allowed-emails?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error || "Unable to load student access.");
        return;
      }

      setAllowedEmails(json.data || []);
      setAccessPagination(json.pagination || accessPagination);
      setAccessSummary(json.summary || accessSummary);
    } catch (err) {
      console.error("Failed to load student access:", err);
      toast.error("Unable to reach the server.");
    } finally {
      setLoadingAccess(false);
    }
  };

  useEffect(() => {
    setRequestPagination((prev) => ({ ...prev, page: 1 }));
  }, [debouncedRequestQuery]);

  useEffect(() => {
    setAccessPagination((prev) => ({ ...prev, page: 1 }));
  }, [debouncedAccessQuery]);

  useEffect(() => {
    if (!user) return;
    fetchRequests();
  }, [
    user,
    requestStatus,
    requestPagination.page,
    requestPagination.pageSize,
    debouncedRequestQuery,
  ]);

  useEffect(() => {
    if (!user || activeView !== "studentAccess") return;
    fetchAllowedEmails();
  }, [user, activeView, accessPagination.page, accessPagination.pageSize, debouncedAccessQuery]);

  const handleUpdateRequestStatus = async (
    id: string,
    status: "approved" | "rejected" | "completed",
    adminNote?: string
  ) => {
    setUpdatingRequestId(id);
    try {
      const res = await fetch(`/api/admin/resubmissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error || "Unable to update the request.");
        return;
      }

      toast.success(
        status === "approved"
          ? "Request approved."
          : status === "completed"
            ? "Request completed."
            : "Request rejected."
      );
      if (status === "rejected") {
        setRejectTarget(null);
        setRejectNote("");
      }
      const nextPage =
        requests.length === 1 && requestPagination.page > 1
          ? requestPagination.page - 1
          : requestPagination.page;
      setRequestPagination((prev) => ({ ...prev, page: nextPage }));
      if (nextPage === requestPagination.page) fetchRequests();
    } catch (err) {
      console.error("Failed to update resubmission:", err);
      toast.error("Unable to reach the server.");
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const handleOpenReject = (request: ResubmissionRequest) => {
    setRejectTarget(request);
    setRejectNote(request.admin_note || "");
  };

  const handleEditAccess = (item: AllowedEmail) => {
    setEditingEmail(item.email);
    setAccessForm({
      email: item.email,
      studentId: item.student_id,
      className: item.class_name,
    });
    setAccessDialogOpen(true);
  };

  const handleAddAccess = () => {
    setEditingEmail(null);
    setAccessForm(emptyAccessForm);
    setAccessDialogOpen(true);
  };

  const resetAccessForm = () => {
    setEditingEmail(null);
    setAccessForm(emptyAccessForm);
    setAccessDialogOpen(false);
  };

  const handleSaveAccess = async () => {
    setSavingAccess(true);
    try {
      const res = await fetch("/api/admin/allowed-emails", {
        method: editingEmail ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accessForm),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error || "Unable to save student access.");
        return;
      }

      toast.success(editingEmail ? "Student access updated." : "Student access added.");
      resetAccessForm();
      setAccessPagination((prev) => ({ ...prev, page: 1 }));
      if (accessPagination.page === 1) fetchAllowedEmails();
    } catch (err) {
      console.error("Failed to save student access:", err);
      toast.error("Unable to reach the server.");
    } finally {
      setSavingAccess(false);
    }
  };

  const handleDeleteAccess = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch("/api/admin/allowed-emails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: deleteTarget.email }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error || "Unable to delete student access.");
        return;
      }

      toast.success("Student access deleted.");
      if (editingEmail === deleteTarget.email) resetAccessForm();
      setDeleteTarget(null);
      const nextPage =
        allowedEmails.length === 1 && accessPagination.page > 1
          ? accessPagination.page - 1
          : accessPagination.page;
      setAccessPagination((prev) => ({ ...prev, page: nextPage }));
      if (nextPage === accessPagination.page) fetchAllowedEmails();
    } catch (err) {
      console.error("Failed to delete student access:", err);
      toast.error("Unable to reach the server.");
    }
  };

  const handleLogout = () => {
    removeAuthCookie();
    toast.success("Signed out.");
    router.push("/");
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-border bg-card lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold tracking-tight">PRN232 Admin</p>
              <p className="text-xs text-muted-foreground">Control console</p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
            <button
              onClick={() => setActiveView("resubmissions")}
              className={`flex min-w-[190px] items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors lg:min-w-0 ${
                activeView === "resubmissions"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              Resubmit Requests
            </button>
            <button
              onClick={() => setActiveView("studentAccess")}
              className={`flex min-w-[190px] items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors lg:min-w-0 ${
                activeView === "studentAccess"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <KeyRound className="h-4 w-4" />
              Student Access
            </button>
          </nav>

          <div className="mt-auto hidden border-t border-border p-4 lg:block">
            <div className="flex min-w-0 items-center gap-3">
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="h-9 w-9 rounded-full border" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{user.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="flex items-start justify-between gap-3 lg:hidden">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {activeView === "resubmissions" ? (
          <ResubmissionPanel
            requests={requests}
            stats={requestSummary}
            status={requestStatus}
            query={requestQuery}
            loading={loadingRequests}
            updatingId={updatingRequestId}
            pagination={requestPagination}
            onStatusChange={(value) => {
              setRequestStatus(value);
              setRequestPagination((prev) => ({ ...prev, page: 1 }));
            }}
            onQueryChange={setRequestQuery}
            onPageChange={(page) => setRequestPagination((prev) => ({ ...prev, page }))}
            onPageSizeChange={(pageSize) =>
              setRequestPagination((prev) => ({ ...prev, page: 1, pageSize }))
            }
            onRefresh={fetchRequests}
            onApprove={(id) => handleUpdateRequestStatus(id, "approved")}
            onComplete={(id) => handleUpdateRequestStatus(id, "completed")}
            onReject={handleOpenReject}
          />
        ) : (
          <StudentAccessPanel
            allowedEmails={allowedEmails}
            summary={accessSummary}
            query={accessQuery}
            loading={loadingAccess}
            pagination={accessPagination}
            onQueryChange={setAccessQuery}
            onPageChange={(page) => setAccessPagination((prev) => ({ ...prev, page }))}
            onPageSizeChange={(pageSize) =>
              setAccessPagination((prev) => ({ ...prev, page: 1, pageSize }))
            }
            onRefresh={fetchAllowedEmails}
            onAdd={handleAddAccess}
            onEdit={handleEditAccess}
            onDelete={setDeleteTarget}
          />
        )}
      </main>

      <StudentAccessDialog
        open={accessDialogOpen}
        editingEmail={editingEmail}
        form={accessForm}
        saving={savingAccess}
        onOpenChange={(open) => {
          setAccessDialogOpen(open);
          if (!open) resetAccessForm();
        }}
        onFormChange={setAccessForm}
        onSave={handleSaveAccess}
      />

      <DeleteStudentAccessDialog
        target={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteAccess}
      />

      <RejectResubmissionDialog
        target={rejectTarget}
        note={rejectNote}
        saving={Boolean(rejectTarget && updatingRequestId === rejectTarget.id)}
        onNoteChange={setRejectNote}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectNote("");
          }
        }}
        onConfirm={() => {
          if (!rejectTarget) return;
          handleUpdateRequestStatus(rejectTarget.id, "rejected", rejectNote);
        }}
      />
    </div>
  );
}

function ResubmissionPanel({
  requests,
  stats,
  status,
  query,
  loading,
  updatingId,
  pagination,
  onStatusChange,
  onQueryChange,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onApprove,
  onComplete,
  onReject,
}: {
  requests: ResubmissionRequest[];
  stats: ResubmissionSummary;
  status: string;
  query: string;
  loading: boolean;
  updatingId: string | null;
  pagination: PaginationMeta;
  onStatusChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRefresh: () => void;
  onApprove: (id: string) => void;
  onComplete: (id: string) => void;
  onReject: (request: ResubmissionRequest) => void;
}) {
  return (
    <div className="motion-panel space-y-4">
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Inline Metrics */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-muted-foreground">Resubmit Requests:</span>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1">
                <span className="text-xs text-muted-foreground">Showing</span>
                <span className="font-extrabold text-foreground">{stats.total}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1">
                <span className="text-xs text-muted-foreground">Pending</span>
                <span className="font-extrabold text-amber-600">{stats.pending}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1">
                <span className="text-xs text-muted-foreground">Approved</span>
                <span className="font-extrabold text-emerald-600">{stats.approved}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1">
                <span className="text-xs text-muted-foreground">Rejected</span>
                <span className="font-extrabold text-red-600">{stats.rejected}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1">
                <span className="text-xs text-muted-foreground">Completed</span>
                <span className="font-extrabold text-sky-600">{stats.completed}</span>
              </div>
            </div>

            {/* Filter, Search & Actions */}
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
              <div className="w-full sm:w-[160px]">
                <Select value={status} onValueChange={onStatusChange}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search student ID, email, class or lab"
                aria-label="Search resubmission requests"
                className="flex-1 max-w-md"
              />

              <Button
                variant="outline"
                size="icon"
                onClick={onRefresh}
                disabled={loading}
                title="Refresh"
                className="shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[138px]">Updated</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="w-[110px]">Class</TableHead>
                    <TableHead className="w-[110px]">Lab</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[112px]">Status</TableHead>
                    <TableHead className="w-[330px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-40" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-12" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-44" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Skeleton className="h-8 w-10" />
                            <Skeleton className="h-8 w-20" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : requests.length === 0 ? (
                    <EmptyTableRow colSpan={7} label="No requests match the current filters." />
                  ) : (
                    requests.map((request, index) => (
                      <TableRow
                        key={request.id}
                        className="motion-list-item"
                        style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
                      >
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(request.updated_at)}
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-semibold">{request.student_id}</p>
                            <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                              {request.name || request.email}
                            </p>
                            <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                              {request.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{request.class_name || "N/A"}</TableCell>
                        <TableCell className="font-mono text-xs">{request.lab_id}</TableCell>
                        <TableCell>
                          <div className="max-w-[300px] space-y-1 text-sm">
                            <p
                              className="truncate text-muted-foreground"
                              title={request.note || ""}
                            >
                              <span className="font-medium text-foreground">Student:</span>{" "}
                              {request.note || "-"}
                            </p>
                            {request.admin_note ? (
                              <p
                                className="truncate text-red-700 dark:text-red-300"
                                title={request.admin_note}
                              >
                                <span className="font-medium">Admin:</span> {request.admin_note}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={request.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <a href={request.drive_link} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                Drive
                              </a>
                            </Button>
                            <Button
                              size="sm"
                              disabled={request.status !== "pending" || updatingId === request.id}
                              onClick={() => onApprove(request.id)}
                            >
                              {updatingId === request.id ? (
                                <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                              )}
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={request.status !== "approved" || updatingId === request.id}
                              onClick={() => onComplete(request.id)}
                            >
                              {updatingId === request.id ? (
                                <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                              )}
                              Complete
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={request.status !== "pending" || updatingId === request.id}
                              onClick={() => onReject(request)}
                            >
                              <XCircle className="mr-2 h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <TablePagination
            pagination={pagination}
            loading={loading}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StudentAccessPanel({
  allowedEmails,
  summary,
  query,
  loading,
  pagination,
  onQueryChange,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onAdd,
  onEdit,
  onDelete,
}: {
  allowedEmails: AllowedEmail[];
  summary: AccessSummary;
  query: string;
  loading: boolean;
  pagination: PaginationMeta;
  onQueryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onEdit: (item: AllowedEmail) => void;
  onDelete: (item: AllowedEmail) => void;
}) {
  return (
    <div className="motion-panel space-y-4">
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Inline Metrics */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-muted-foreground">Student Access:</span>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1">
                <span className="text-xs text-muted-foreground">Emails</span>
                <span className="font-extrabold text-foreground">{summary.total}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1">
                <span className="text-xs text-muted-foreground">Classes</span>
                <span className="font-extrabold text-primary">{summary.classes}</span>
              </div>
            </div>

            {/* Search & Actions */}
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center md:justify-end">
              <Input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search email, student ID or class"
                aria-label="Search student access"
                className="max-w-md"
              />

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onRefresh}
                  disabled={loading}
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button onClick={onAdd}>Add Student</Button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[140px]">MSSV</TableHead>
                    <TableHead className="w-[140px]">Class</TableHead>
                    <TableHead className="w-[170px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4 rounded-full" />
                            <Skeleton className="h-4 w-48" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Skeleton className="h-8 w-10" />
                            <Skeleton className="h-8 w-20" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : allowedEmails.length === 0 ? (
                    <EmptyTableRow
                      colSpan={4}
                      label="No student access records match the current filters."
                    />
                  ) : (
                    allowedEmails.map((item, index) => (
                      <TableRow
                        key={item.email}
                        className="motion-list-item"
                        style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
                      >
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-2">
                            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate font-medium">{item.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.student_id}</TableCell>
                        <TableCell>{item.class_name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => onDelete(item)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <TablePagination
            pagination={pagination}
            loading={loading}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function TablePagination({
  pagination,
  loading,
  onPageChange,
  onPageSizeChange,
}: {
  pagination: PaginationMeta;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.total, pagination.page * pagination.pageSize);
  const canPrevious = pagination.page > 1 && !loading;
  const canNext = pagination.page < pagination.totalPages && !loading;

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        Showing {start}-{end} of {pagination.total}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            disabled={loading}
          >
            <SelectTrigger className="h-9 w-[88px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="min-w-[96px] text-center text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={!canPrevious}
              onClick={() => onPageChange(1)}
              title="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canPrevious}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canNext}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={!canNext}
              onClick={() => onPageChange(pagination.totalPages)}
              title="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentAccessDialog({
  open,
  editingEmail,
  form,
  saving,
  onOpenChange,
  onFormChange,
  onSave,
}: {
  open: boolean;
  editingEmail: string | null;
  form: typeof emptyAccessForm;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (value: typeof emptyAccessForm) => void;
  onSave: () => void;
}) {
  const canSave = form.email.trim() && form.studentId.trim() && form.className.trim() && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingEmail ? "Edit Student Access" : "Add Student Access"}</DialogTitle>
          <DialogDescription>
            The email must match the Google account the student uses to sign in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={form.email}
            onChange={(event) => onFormChange({ ...form, email: event.target.value })}
            placeholder="student@fpt.edu.vn"
            disabled={Boolean(editingEmail)}
            aria-label="Student email"
          />
          <Input
            value={form.studentId}
            onChange={(event) => onFormChange({ ...form, studentId: event.target.value })}
            placeholder="Student ID, for example SE182672"
            aria-label="Student ID"
          />
          <Input
            value={form.className}
            onChange={(event) => onFormChange({ ...form, className: event.target.value })}
            placeholder="Class, for example SE1815"
            aria-label="Class"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave}>
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editingEmail ? "Save Changes" : "Add Student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteStudentAccessDialog({
  target,
  onOpenChange,
  onConfirm,
}: {
  target: AllowedEmail | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Student Access</DialogTitle>
          <DialogDescription>
            This removes the Google sign-in whitelist entry for {target?.email}. The student will no
            longer be able to access the dashboard.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete Access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectResubmissionDialog({
  target,
  note,
  saving,
  onNoteChange,
  onOpenChange,
  onConfirm,
}: {
  target: ResubmissionRequest | null;
  note: string;
  saving: boolean;
  onNoteChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const canReject = note.trim().length > 0 && !saving;

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Resubmission Request</DialogTitle>
          <DialogDescription>
            Add a note for {target?.student_id} so the student knows what to fix before submitting
            again.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Explain why this resubmission is rejected"
          className="min-h-[120px]"
          aria-label="Reject note"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!canReject}>
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reject Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" | "completed" }) {
  const className =
    status === "pending"
      ? "border-none bg-amber-500 text-white hover:bg-amber-600"
      : status === "approved"
        ? "border-none bg-emerald-500 text-white hover:bg-emerald-600"
        : status === "completed"
          ? "border-none bg-sky-600 text-white hover:bg-sky-700"
          : "border-none bg-red-600 text-white hover:bg-red-700";

  return <Badge className={className}>{status}</Badge>;
}

function EmptyTableRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-28 text-center text-sm text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}
