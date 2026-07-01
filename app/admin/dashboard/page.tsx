"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { toast } from "sonner";
import {
  GraduationCap,
  KeyRound,
  LogOut,
  UploadCloud,
  User as UserIcon,
} from "lucide-react";

import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { ROLE_ADMIN } from "@/lib/types/roles";
import { removeAuthCookie, UserPayload } from "@/lib/utils/auth";
import {
  getAllowedEmailsAction,
  saveAllowedEmailAction,
  deleteAllowedEmailAction,
  getAdminResubmissionsAction,
  updateResubmissionStatusAction,
} from "@/lib/actions/admin";
import {
  AllowedEmail,
  ResubmissionRequest,
  StudentAccessDialog,
  DeleteStudentAccessDialog,
  RejectResubmissionDialog,
} from "@/components/admin/Dialogs";
import { PaginationMeta } from "@/components/admin/TablePagination";
import { ResubmissionPanel, ResubmissionSummary } from "@/components/admin/ResubmissionPanel";
import { StudentAccessPanel, AccessSummary } from "@/components/admin/StudentAccessPanel";

type AdminView = "resubmissions" | "studentAccess";

const emptyAccessForm = {
  email: "",
  studentId: "",
  className: "",
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
      const json = await getAdminResubmissionsAction({
        status: requestStatus,
        page: requestPagination.page,
        pageSize: requestPagination.pageSize,
        q: debouncedRequestQuery.trim() || undefined,
      });

      if (!json.success) {
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
      const json = await getAllowedEmailsAction({
        page: accessPagination.page,
        pageSize: accessPagination.pageSize,
        q: debouncedAccessQuery.trim() || undefined,
      });

      if (!json.success) {
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
      const json = await updateResubmissionStatusAction(id, status, adminNote);

      if (!json.success) {
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
      const json = await saveAllowedEmailAction({
        ...accessForm,
        isEdit: Boolean(editingEmail),
      });

      if (!json.success) {
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
      const json = await deleteAllowedEmailAction(deleteTarget.email);

      if (!json.success) {
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

