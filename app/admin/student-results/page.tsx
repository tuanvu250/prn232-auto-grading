"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import {
  BarChart3,
  GraduationCap,
  KeyRound,
  LogOut,
  UploadCloud,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { ROLE_ADMIN } from "@/lib/types/roles";
import { removeAuthCookie, UserPayload } from "@/lib/utils/auth";
import {
  getAdminStudentResultFiltersAction,
  getAdminStudentResultsAction,
} from "@/lib/actions/admin";
import { PaginationMeta } from "@/components/admin/TablePagination";
import {
  StudentResultRow,
  StudentResultSummary,
  StudentResultsPanel,
} from "@/components/admin/StudentResultsPanel";

const emptySummary: StudentResultSummary = {
  total: 0,
  submitted: 0,
  notSubmitted: 0,
  passed: 0,
  failed: 0,
  grading: 0,
  averageScore: null,
};

export default function AdminStudentResultsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserPayload | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [labs, setLabs] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedLab, setSelectedLab] = useState("");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);
  const [rows, setRows] = useState<StudentResultRow[]>([]);
  const [summary, setSummary] = useState<StudentResultSummary>(emptySummary);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
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

  const fetchFilters = async (className?: string) => {
    setLoadingFilters(true);
    try {
      const json = await getAdminStudentResultFiltersAction(className);

      if (!json.success) {
        toast.error(json.error || "Unable to load filters.");
        return;
      }

      setClasses(json.classes || []);
      setLabs(json.labs || []);
    } catch (err) {
      console.error("Failed to load student result filters:", err);
      toast.error("Unable to reach the server.");
    } finally {
      setLoadingFilters(false);
    }
  };

  const fetchResults = async () => {
    if (!selectedClass || !selectedLab) {
      setRows([]);
      setSummary(emptySummary);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
      return;
    }

    setLoadingResults(true);
    try {
      const json = await getAdminStudentResultsAction({
        className: selectedClass,
        labId: selectedLab,
        q: debouncedQuery.trim() || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      });

      if (!json.success) {
        toast.error(json.error || "Unable to load student results.");
        return;
      }

      setRows((json.data || []) as StudentResultRow[]);
      setPagination(json.pagination || pagination);
      setSummary((json.summary || emptySummary) as StudentResultSummary);
    } catch (err) {
      console.error("Failed to load student results:", err);
      toast.error("Unable to reach the server.");
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchFilters();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedClass) return;
    fetchFilters(selectedClass);
  }, [user, selectedClass]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [debouncedQuery, selectedClass, selectedLab]);

  useEffect(() => {
    if (!user) return;
    fetchResults();
  }, [user, selectedClass, selectedLab, pagination.page, pagination.pageSize, debouncedQuery]);

  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setSelectedLab("");
    setRows([]);
    setSummary(emptySummary);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleLabChange = (value: string) => {
    setSelectedLab(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleBackToClasses = () => {
    setSelectedClass("");
    setSelectedLab("");
    setQuery("");
    setRows([]);
    setSummary(emptySummary);
    setLabs([]);
    setPagination((prev) => ({ ...prev, page: 1, total: 0, totalPages: 1 }));
  };

  const handleBackToLabs = () => {
    setSelectedLab("");
    setQuery("");
    setRows([]);
    setSummary(emptySummary);
    setPagination((prev) => ({ ...prev, page: 1, total: 0, totalPages: 1 }));
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
            <Button
              asChild
              variant="ghost"
              className="min-w-[190px] justify-start gap-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:min-w-0"
            >
              <Link href="/admin/dashboard">
                <UploadCloud className="h-4 w-4" />
                Resubmit Requests
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="min-w-[190px] justify-start gap-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:min-w-0"
            >
              <Link href="/admin/dashboard">
                <KeyRound className="h-4 w-4" />
                Student Access
              </Link>
            </Button>
            <Button
              asChild
              className="min-w-[190px] justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90 lg:min-w-0"
            >
              <Link href="/admin/student-results">
                <BarChart3 className="h-4 w-4" />
                Student Results
              </Link>
            </Button>
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

        <div className="space-y-1">
          <h1 className="text-xl font-extrabold tracking-tight">Student Results</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Review class lab outcomes by selecting a class first, then a lab.
          </p>
        </div>

        <StudentResultsPanel
          classes={classes}
          labs={labs}
          selectedClass={selectedClass}
          selectedLab={selectedLab}
          query={query}
          rows={rows}
          summary={summary}
          loadingFilters={loadingFilters}
          loadingResults={loadingResults}
          pagination={pagination}
          onClassChange={handleClassChange}
          onLabChange={handleLabChange}
          onQueryChange={setQuery}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
          onPageSizeChange={(pageSize) => setPagination((prev) => ({ ...prev, page: 1, pageSize }))}
          onRefresh={() => {
            fetchFilters(selectedClass || undefined);
            fetchResults();
          }}
          onBackToClasses={handleBackToClasses}
          onBackToLabs={handleBackToLabs}
        />
      </main>
    </div>
  );
}
