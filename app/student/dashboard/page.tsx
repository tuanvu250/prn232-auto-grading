"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { toast } from "sonner";
import {
  LogOut,
  GraduationCap,
  Calendar,
  Code2,
  Clock,
  ChevronRight,
  User as UserIcon,
  ArrowUp,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { removeAuthCookie, UserPayload } from "@/lib/utils/auth";
import { LabAssignment, SubmissionHistory, TestcaseResult } from "@/lib/api/studentData";

interface ResubmissionRequest {
  id: string;
  lab_id: string;
  drive_link: string;
  note?: string | null;
  status: "pending" | "completed";
  updated_at: string;
  completed_at?: string | null;
}

interface DbTestcase {
  name?: string;
  passed?: boolean;
  error?: string;
  score?: number;
  max_score?: number;
  actual_response?: string | null;
  actual_status_code?: number | null;
}

interface DbSubmission {
  lab_id: string;
  score?: number | string | null;
  status?: string | null;
  updated_at: string;
  details?: {
    tests?: DbTestcase[];
    passed?: number;
    total?: number;
    build_logs?: string;
    buildLogs?: string;
    log?: string;
  } | null;
}

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

const mapStatus = (status: string, score: number): "Passed" | "Failed" | "Grading" => {
  const s = status.toLowerCase();
  if (s === "grading" || s === "pending") {
    return "Grading";
  }
  return score >= 5.0 ? "Passed" : "Failed";
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
    <span className={`inline-flex items-center justify-center rounded-sm px-2 py-0.5 text-[10px] font-bold min-w-[52px] text-center tracking-wide ${colorClass}`}>
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

export default function StudentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserPayload | null>(null);

  // Lab list loaded from Supabase.
  const [labs, setLabs] = useState<LabAssignment[]>([]);

  // Currently selected lab.
  const [selectedLab, setSelectedLab] = useState<LabAssignment | null>(null);

  // Currently selected submission version for the selected lab.
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionHistory | null>(null);
  const [loadingGrades, setLoadingGrades] = useState(true);
  const [resubmissions, setResubmissions] = useState<ResubmissionRequest[]>([]);
  const [loadingResubmissions, setLoadingResubmissions] = useState(false);
  const [savingResubmission, setSavingResubmission] = useState(false);
  const [driveLink, setDriveLink] = useState("");
  const [resubmitNote, setResubmitNote] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Toggle the scroll-to-top button while scrolling.
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Sync and validate the current user.
  useEffect(() => {
    const token = Cookies.get("authToken");
    if (!token) {
      router.push("/");
      return;
    }
    try {
      const decoded = jwtDecode<UserPayload>(token);
      setUser(decoded);
    } catch {
      toast.error("Invalid session. Please sign in again.");
      removeAuthCookie();
      router.push("/");
    }
  }, [router]);

  // Keep selectedLab in sync when labs are refreshed.
  useEffect(() => {
    if (labs.length > 0) {
      const curSelected = selectedLab ? labs.find((l) => l.id === selectedLab.id) : null;
      setSelectedLab(curSelected || labs[0]);
    } else {
      setSelectedLab(null);
    }
  }, [labs]);

  // Update the selected submission when the selected lab changes.
  useEffect(() => {
    if (selectedLab && selectedLab.submissions.length > 0) {
      setSelectedSubmission(selectedLab.submissions[0]); // Default to the latest submission.
    } else {
      setSelectedSubmission(null);
    }
  }, [selectedLab]);

  useEffect(() => {
    const currentRequest = selectedLab
      ? resubmissions.find((request) => request.lab_id === selectedLab.id)
      : null;

    setDriveLink(currentRequest?.drive_link || "");
    setResubmitNote(currentRequest?.note || "");
  }, [selectedLab, resubmissions]);

  function mergeSubmissions(dbSubmissions: DbSubmission[]) {
    const updatedLabs: LabAssignment[] = dbSubmissions.map((sub) => {
      const details = sub.details || {};
      const tests = details.tests || [];
      const testcaseDetails: TestcaseResult[] = tests.map((t) => ({
        name: t.name || "Testcase",
        status: t.passed ? "pass" : "fail",
        message: t.error || undefined,
        score: t.score,
        maxScore: t.max_score,
        actualResponse: t.actual_response,
        actualStatusCode: t.actual_status_code,
      }));

      const buildLogs =
        details.build_logs ||
        details.buildLogs ||
        details.log ||
        "Build succeeded. No error logs found.";

      const mappedSubmission: SubmissionHistory = {
        version: 1,
        submittedAt: formatDate(sub.updated_at),
        score: Number(sub.score) || 0,
        status: mapStatus(sub.status || "", Number(sub.score) || 0),
        testcasesPassed: Number(details.passed) || testcaseDetails.filter(t => t.status === "pass").length,
        testcasesTotal: Number(details.total) || testcaseDetails.length,
        buildLogs,
        testcaseDetails,
      };

      return {
        id: sub.lab_id,
        title: sub.lab_id,
        description: "Automated grading details from the system.",
        dueDate: "N/A",
        weight: 0,
        status: mappedSubmission.status,
        currentScore: mappedSubmission.score,
        submissions: [mappedSubmission],
      };
    });

    // Sort by lab name.
    updatedLabs.sort((a, b) => a.title.localeCompare(b.title));
    setLabs(updatedLabs);
  }

  // Fetch grades through the API route to keep server-side authorization in place.
  useEffect(() => {
    if (!user || !user.studentId) return;

    const fetchGrades = async () => {
      setLoadingGrades(true);
      try {
        const res = await fetch("/api/grades");
        const json = await res.json();
        if (json.success) {
          mergeSubmissions(json.data || []);
        } else {
          console.error("Failed to load grades:", json.error);
          toast.error("Unable to load grades.");
          mergeSubmissions([]);
        }
      } catch (err) {
        console.error("Grades API connection failed:", err);
        toast.error("Unable to reach the server.");
        mergeSubmissions([]);
      } finally {
        setLoadingGrades(false);
      }
    };

    fetchGrades();
  }, [user]);

  useEffect(() => {
    if (!user || !user.studentId) return;

    const fetchResubmissions = async () => {
      setLoadingResubmissions(true);
      try {
        const res = await fetch("/api/resubmissions");
        const json = await res.json();
        if (json.success) {
          setResubmissions(json.data || []);
        } else {
          console.error("Failed to load resubmission requests:", json.error);
        }
      } catch (err) {
        console.error("Resubmissions API connection failed:", err);
      } finally {
        setLoadingResubmissions(false);
      }
    };

    fetchResubmissions();
  }, [user]);

  // Sort test cases: SOURCE first, then API methods.
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

  const handleLogout = () => {
    removeAuthCookie();
    toast.success("Signed out.");
    router.push("/login");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Passed":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none">Passed</Badge>;
      case "Failed":
        return <Badge variant="destructive" className="border-none">Failed</Badge>;
      case "Grading":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none animate-pulse">Grading</Badge>;
      default:
        return <Badge variant="outline">Not Submitted</Badge>;
    }
  };

  const handleSelectLab = (lab: LabAssignment, scrollToDetail = false) => {
    setSelectedLab(lab);
    if (scrollToDetail) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const getSelectedResubmission = () => {
    if (!selectedLab) return null;
    return resubmissions.find((request) => request.lab_id === selectedLab.id) || null;
  };

  const handleSaveResubmission = async () => {
    if (!selectedLab) return;

    setSavingResubmission(true);
    try {
      const res = await fetch("/api/resubmissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId: selectedLab.id,
          driveLink,
          note: resubmitNote,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error || "Unable to submit the resubmission request.");
        return;
      }

      setResubmissions((prev) => {
        const others = prev.filter((request) => request.id !== json.data.id);
        return [json.data, ...others];
      });
      toast.success("Resubmission request sent. Admins will receive a Discord notification.");
    } catch (err) {
      console.error("Failed to save resubmission request:", err);
      toast.error("Unable to reach the server.");
    } finally {
      setSavingResubmission(false);
    }
  };

  const renderMainPanelSkeleton = () => {
    return (
      <Card className="border-border bg-card shadow-sm h-full flex flex-col">
        <CardContent className="min-w-0 flex-1 p-3 sm:p-6 space-y-6 animate-pulse">
          {/* Page Header Skeleton */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-6">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-48 sm:h-8" />
              <div className="flex gap-2 flex-wrap">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>

          {/* Table Skeleton */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/40 p-3 flex justify-between">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/12" />
                <Skeleton className="h-4 w-1/12" />
                <Skeleton className="h-4 w-1/12" />
              </div>
              <div className="divide-y divide-border">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="p-3 flex justify-between">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-4 w-1/12" />
                    <Skeleton className="h-4 w-1/12" />
                    <Skeleton className="h-4 w-1/12" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderLabList = () => {
    if (loadingGrades) {
      return (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="border border-border bg-card rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <div className="space-y-1.5 items-end flex flex-col">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <div className="flex justify-between items-center pt-1">
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (labs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-card text-muted-foreground text-center gap-2">
          <p className="text-sm font-medium">No graded submissions yet</p>
          <p className="text-xs text-muted-foreground">Submit your work through the grading system and results will appear here.</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {labs.map((lab, index) => {
          const isSelected = selectedLab?.id === lab.id;
          return (
            <button
              key={lab.id}
              onClick={() => handleSelectLab(lab)}
              style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
              className={`w-full text-left rounded-lg border p-4 transition-all duration-200 ${
                "motion-list-item "
              }${
                isSelected
                  ? "border-primary bg-primary/[0.02] shadow-sm"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <h3 className="break-words font-sans text-sm font-bold leading-tight">
                    {lab.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Due: {lab.dueDate}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">
                    {lab.status === "Grading" ? "--" : `${lab.currentScore.toFixed(1)}/10`}
                  </p>
                  <div className="mt-1">{getStatusBadge(lab.status)}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                {lab.weight > 0 ? (
                  <span>Weight: {lab.weight}%</span>
                ) : (
                  <span></span>
                )}
                {isSelected && (
                  <span className="flex items-center gap-0.5 text-primary font-medium">
                    Viewing <ChevronRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderLabSlider = () => {
    if (loadingGrades) {
      return (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
          <div className="flex snap-x snap-mandatory gap-3 animate-pulse">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div
                key={idx}
                className="min-h-[116px] w-[78vw] max-w-[320px] shrink-0 snap-start rounded-lg border border-border bg-card p-4 text-left sm:w-[300px] flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-14" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (labs.length === 0) {
      return (
        <div className="rounded-lg border border-dashed bg-card p-4 text-muted-foreground">
          <p className="text-sm font-medium">No graded submissions yet</p>
          <p className="mt-1 text-xs">Results will appear here after grading is complete.</p>
        </div>
      );
    }

    return (
      <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        <div className="flex snap-x snap-mandatory gap-3">
          {labs.map((lab, index) => {
            const isSelected = selectedLab?.id === lab.id;
            return (
              <button
                key={lab.id}
                onClick={() => handleSelectLab(lab, true)}
                style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
                className={`min-h-[116px] w-[78vw] max-w-[320px] shrink-0 snap-start rounded-lg border p-4 text-left transition-all duration-200 sm:w-[300px] ${
                  "motion-list-item "
                }${
                  isSelected
                    ? "border-primary bg-primary/[0.03]"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex h-full flex-col justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 break-words text-sm font-bold leading-tight text-foreground">
                        {lab.title}
                      </h3>
                      {isSelected && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Viewing
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span className="truncate">Due: {lab.dueDate}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base font-extrabold text-foreground">
                      {lab.status === "Grading" ? "--" : `${lab.currentScore.toFixed(1)}/10`}
                    </span>
                    {getStatusBadge(lab.status)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-200">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 min-w-0 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="truncate font-sans text-base font-bold tracking-tight sm:text-lg">
              PRN232 Auto Grading
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {/* User Profile Info */}
            <div className="flex min-w-0 items-center gap-3 border-r border-border pr-3 sm:pr-4">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="h-8 w-8 shrink-0 rounded-full border border-border"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold leading-none">
                  {user.name} {user.className ? `(${user.className})` : ""}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  {user.studentId ? `${user.studentId} | ` : ""}{user.email}
                </p>
              </div>
              <Badge variant="outline" className="hidden text-[10px] sm:inline-block border-primary/20 bg-primary/5 text-primary">
                Student
              </Badge>
            </div>

            {/* Logout Button */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                onClick={handleLogout}
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto grid flex-1 grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight">Lab Assignments</h2>
              {selectedLab && !loadingGrades && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Viewing: {selectedLab.title}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              Total: {labs.length}
            </span>
          </div>
          {renderLabSlider()}
        </div>

        {/* Left Side: Lab Assignment List (Sticky & Smaller sidebar: lg:col-span-3) */}
        <section className="hidden space-y-4 lg:col-span-3 lg:sticky lg:top-20 lg:block lg:self-start lg:max-h-[calc(100vh-6rem)] overflow-y-auto pr-1 w-full min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Lab Assignments</h2>
            <span className="text-xs text-muted-foreground font-sans">
              Total: {labs.length}
            </span>
          </div>

          {renderLabList()}
        </section>

        {/* Right Side: Diagnostic Console & Detail (Main content: lg:col-span-9) */}
        <section className="space-y-4 lg:col-span-9 w-full min-w-0">
          {loadingGrades ? (
            renderMainPanelSkeleton()
          ) : selectedLab ? (
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
                        <span>Status: <span className="font-semibold text-foreground">{selectedSubmission.status}</span></span>
                        <span>•</span>
                        <span>Total score: <span className="font-extrabold text-foreground">{selectedSubmission.score.toFixed(2)} / 10</span></span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> At {selectedSubmission.submittedAt}
                        </span>
                      </div>
                    </div>

                    {/* Version selection dropdown */}
                    {selectedLab.submissions.length > 1 && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground font-medium">Submission version:</span>
                        <select
                          value={selectedSubmission.version}
                          onChange={(e) => {
                            const v = parseInt(e.target.value);
                            const sub = selectedLab.submissions.find((s) => s.version === v);
                            if (sub) setSelectedSubmission(sub);
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
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground font-sans">
                    This assignment has not been submitted yet. Submit your code through the grading system to receive results.
                  </div>
                )}

                {selectedSubmission && (
                  <div className="space-y-6">
                    {(() => {
                      const request = getSelectedResubmission();
                      const isCompleted = request?.status === "completed";
                      const canSubmit = driveLink.trim().length > 0 && !isCompleted && !savingResubmission;

                      return (
                        <div className="motion-panel rounded-lg border border-border bg-muted/20 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-bold text-foreground">Resubmission Request</h3>
                                {request ? (
                                  <Badge
                                    className={
                                      request.status === "pending"
                                        ? "border-none bg-amber-500 text-white hover:bg-amber-600"
                                        : "border-none bg-emerald-500 text-white hover:bg-emerald-600"
                                    }
                                  >
                                    {request.status === "pending" ? "Pending" : "Completed"}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Submit a Google Drive link for the selected lab. You can update the link while the request is pending.
                              </p>
                            </div>
                            {request?.drive_link ? (
                              <Button variant="outline" size="sm" asChild className="shrink-0">
                                <a href={request.drive_link} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                  Open Link
                                </a>
                              </Button>
                            ) : null}
                          </div>

                          <div className="mt-4 grid gap-3">
                            <Input
                              value={driveLink}
                              onChange={(event) => setDriveLink(event.target.value)}
                              placeholder="https://drive.google.com/..."
                              disabled={isCompleted}
                              aria-label="Google Drive resubmission link"
                            />
                            <Textarea
                              value={resubmitNote}
                              onChange={(event) => setResubmitNote(event.target.value)}
                              placeholder="Optional note for admin"
                              disabled={isCompleted}
                              className="min-h-[72px]"
                              aria-label="Resubmission note"
                            />
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-xs text-muted-foreground">
                                {loadingResubmissions
                                  ? "Loading request status..."
                                  : request
                                    ? `Last updated: ${formatDate(request.updated_at)}`
                                    : "No resubmission request for this lab yet."}
                              </p>
                              <Button
                                onClick={handleSaveResubmission}
                                disabled={!canSubmit}
                                className="sm:w-auto"
                              >
                                {savingResubmission ? (
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                {request ? "Update Link" : "Submit Request"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Testcases list Table */}
                    <div className="border border-border rounded-lg overflow-hidden overflow-x-auto bg-card w-full">
                      <Table className="max-lg:min-w-[680px]">
                        <TableHeader className="bg-muted/50 border-b">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[100px] text-xs font-bold uppercase text-muted-foreground">Method</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-muted-foreground">URL / Rule</TableHead>
                            <TableHead className="w-[80px] text-xs font-bold uppercase text-muted-foreground">Pass</TableHead>
                            <TableHead className="w-[100px] text-xs font-bold uppercase text-muted-foreground">Awarded</TableHead>
                            <TableHead className="w-[100px] text-xs font-bold uppercase text-muted-foreground">Effective</TableHead>
                            <TableHead className="w-[80px] text-xs font-bold uppercase text-muted-foreground">HTTP</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getSortedTestcases(selectedSubmission).map((tc, idx) => {
                            const { method, rule } = parseTestcase(tc.name);
                            const isPassed = tc.status === "pass";
                            const awarded = tc.score !== undefined ? tc.score : (isPassed ? 1 : 0);
                            const effective = tc.score !== undefined ? tc.score : (isPassed ? 1 : 0);
                            const httpCode = tc.actualStatusCode !== undefined && tc.actualStatusCode !== null 
                              ? tc.actualStatusCode 
                              : (method === "SOURCE" ? "-" : "200");

                            return (
                              <TableRow key={idx} className="hover:bg-muted/5 border-b border-border/40 transition-colors">
                                <TableCell className="py-3">{getMethodBadge(method)}</TableCell>
                                <TableCell className="py-3 font-mono text-xs text-foreground max-w-[180px] sm:max-w-[350px] truncate" title={rule}>
                                  {rule}
                                </TableCell>
                                <TableCell className="py-3">
                                  {isPassed ? (
                                    <span className="text-emerald-500 font-bold text-base">✓</span>
                                  ) : (
                                    <span className="text-red-500 font-bold text-base">X</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-3 font-semibold text-xs text-foreground">{awarded.toFixed(1)}</TableCell>
                                <TableCell className="py-3 font-semibold text-xs text-foreground">{effective.toFixed(1)}</TableCell>
                                <TableCell className="py-3 font-medium text-xs text-muted-foreground">
                                  {httpCode}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Response details Section */}
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
                              <div className="break-words text-xs font-bold text-muted-foreground font-mono [overflow-wrap:anywhere]">
                                {method} {rule}
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
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card shadow-sm h-full flex items-center justify-center p-8 text-center text-muted-foreground font-sans">
              <div className="flex flex-col items-center gap-2 max-w-md">
                <Code2 className="h-8 w-8 text-muted-foreground/60" />
                <h3 className="font-bold text-foreground mt-2">No graded submissions yet</h3>
                <p className="text-sm">You have not submitted any assignments to the automated grading system yet.</p>
              </div>
            </Card>
          )}
        </section>
      </main>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full shadow-lg bg-orange-500 hover:bg-orange-600 text-white transition-all duration-300 p-0 flex items-center justify-center animate-in fade-in slide-in-from-bottom-4"
          size="icon"
          title="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
