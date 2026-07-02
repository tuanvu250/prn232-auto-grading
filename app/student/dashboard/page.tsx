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
  Code2,
  User as UserIcon,
  ArrowUp,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { removeAuthCookie, UserPayload } from "@/lib/utils/auth";
import { LabAssignment, SubmissionHistory, TestcaseResult } from "@/lib/api/studentData";
import { getStudentGradesAction, getStudentMissingLabsAction } from "@/lib/actions/grades";
import {
  getStudentResubmissionsAction,
  createResubmissionAction,
} from "@/lib/actions/resubmissions";
import { LabList } from "@/components/student/LabList";
import { LabSlider } from "@/components/student/LabSlider";
import { DiagnosticConsole } from "@/components/student/DiagnosticConsole";
import { MainPanelSkeleton } from "@/components/student/MainPanelSkeleton";

interface ResubmissionRequest {
  id: string;
  lab_id: string;
  drive_link: string;
  note?: string | null;
  admin_note?: string | null;
  status: "pending" | "approved" | "rejected" | "completed";
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

const createLateSubmissionLab = (labId: string): LabAssignment => ({
  id: labId,
  title: labId,
  description: "No graded submission found for this lab.",
  dueDate: "N/A",
  weight: 0,
  status: "NotSubmitted",
  currentScore: 0,
  submissions: [],
});

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
  const [missingLabIds, setMissingLabIds] = useState<string[]>([]);
  const [loadingResubmissions, setLoadingResubmissions] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [lateDialogOpen, setLateDialogOpen] = useState(false);
  const [lateLabId, setLateLabId] = useState("");
  const [lateDriveLink, setLateDriveLink] = useState("");
  const [lateNote, setLateNote] = useState("");
  const [savingLateRequest, setSavingLateRequest] = useState(false);

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

  useEffect(() => {
    setAvatarError(false);
  }, [user?.picture]);

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

  function mergeSubmissions(
    dbSubmissions: DbSubmission[],
    requestRows: ResubmissionRequest[] = resubmissions,
    missingLabs: string[] = missingLabIds
  ) {
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
        testcasesPassed:
          Number(details.passed) || testcaseDetails.filter((t) => t.status === "pass").length,
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

    requestRows.forEach((request) => {
      const hasLab = updatedLabs.some((lab) => lab.id === request.lab_id);
      if (hasLab) return;

      updatedLabs.push(createLateSubmissionLab(request.lab_id));
    });

    missingLabs.forEach((labId) => {
      const hasLab = updatedLabs.some((lab) => lab.id === labId);
      if (hasLab) return;

      updatedLabs.push(createLateSubmissionLab(labId));
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
        const [gradesJson, missingLabsJson] = await Promise.all([
          getStudentGradesAction(),
          getStudentMissingLabsAction(),
        ]);

        const nextMissingLabIds = missingLabsJson.success ? missingLabsJson.data || [] : [];
        setMissingLabIds(nextMissingLabIds);

        if (!missingLabsJson.success) {
          console.error("Failed to load missing labs:", missingLabsJson.error);
        }

        if (gradesJson.success) {
          mergeSubmissions(gradesJson.data || [], resubmissions, nextMissingLabIds);
        } else {
          console.error("Failed to load grades:", gradesJson.error);
          toast.error("Unable to load grades.");
          mergeSubmissions([], resubmissions, nextMissingLabIds);
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
        const json = await getStudentResubmissionsAction();
        if (json.success) {
          const requestRows = json.data || [];
          setResubmissions(requestRows);
          setLabs((prevLabs) => {
            const updatedLabs = [...prevLabs];
            requestRows.forEach((request) => {
              const hasLab = updatedLabs.some((lab) => lab.id === request.lab_id);
              if (hasLab) return;

              updatedLabs.push(createLateSubmissionLab(request.lab_id));
            });
            missingLabIds.forEach((labId) => {
              const hasLab = updatedLabs.some((lab) => lab.id === labId);
              if (hasLab) return;

              updatedLabs.push(createLateSubmissionLab(labId));
            });
            return updatedLabs.sort((a, b) => a.title.localeCompare(b.title));
          });
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

  const handleSelectLab = (lab: LabAssignment, scrollToDetail = false) => {
    setSelectedLab(lab);
    if (scrollToDetail) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleLogout = () => {
    removeAuthCookie();
    toast.success("Signed out.");
    router.push("/login");
  };

  const handleSaveLateRequest = async () => {
    const labId = lateLabId.trim();
    const driveLink = lateDriveLink.trim();

    if (!labId || !driveLink) {
      toast.error("Lab ID and Drive link are required.");
      return;
    }

    setSavingLateRequest(true);
    try {
      const json = await createResubmissionAction({
        labId,
        driveLink,
        note: lateNote,
      });

      if (!json.success) {
        toast.error(json.error || "Unable to submit the late submission request.");
        return;
      }

      const newRequest = json.data as ResubmissionRequest;
      setResubmissions((prev) => {
        const others = prev.filter((r) => r.id !== newRequest.id);
        return [newRequest, ...others];
      });
      setLabs((prevLabs) => {
        if (prevLabs.some((lab) => lab.id === newRequest.lab_id)) {
          return prevLabs;
        }

        return [...prevLabs, createLateSubmissionLab(newRequest.lab_id)].sort((a, b) =>
          a.title.localeCompare(b.title)
        );
      });
      setSelectedLab((current) => current || createLateSubmissionLab(newRequest.lab_id));
      toast.success("Late submission request sent. Admins will receive a Discord notification.");
      setLateDialogOpen(false);
      setLateLabId("");
      setLateDriveLink("");
      setLateNote("");
    } catch (err) {
      console.error("Failed to save late submission request:", err);
      toast.error("Unable to reach the server.");
    } finally {
      setSavingLateRequest(false);
    }
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
              {user.picture && !avatarError ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
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
                  {user.studentId ? `${user.studentId} | ` : ""}
                  {user.email}
                </p>
              </div>
              <Badge
                variant="outline"
                className="hidden text-[10px] sm:inline-block border-primary/20 bg-primary/5 text-primary"
              >
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
            <span className="shrink-0 text-xs text-muted-foreground">Total: {labs.length}</span>
          </div>
          <LabSlider
            labs={labs}
            selectedLab={selectedLab}
            loadingGrades={loadingGrades}
            onSelectLab={handleSelectLab}
          />
        </div>

        {/* Left Side: Lab Assignment List (Sticky & Smaller sidebar: lg:col-span-3) */}
        <section className="hidden space-y-4 lg:col-span-3 lg:sticky lg:top-20 lg:block lg:self-start lg:max-h-[calc(100vh-6rem)] overflow-y-auto pr-1 w-full min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Lab Assignments</h2>
            <span className="text-xs text-muted-foreground font-sans">Total: {labs.length}</span>
          </div>

          <LabList
            labs={labs}
            selectedLab={selectedLab}
            loadingGrades={loadingGrades}
            onSelectLab={handleSelectLab}
          />
        </section>

        {/* Right Side: Diagnostic Console & Detail (Main content: lg:col-span-9) */}
        <section className="space-y-4 lg:col-span-9 w-full min-w-0">
          {loadingGrades ? (
            <MainPanelSkeleton />
          ) : selectedLab ? (
            <DiagnosticConsole
              user={user!}
              selectedLab={selectedLab}
              selectedSubmission={selectedSubmission}
              onSelectSubmission={setSelectedSubmission}
              resubmissions={resubmissions}
              loadingResubmissions={loadingResubmissions}
              onResubmissionSaved={(newRequest) => {
                setResubmissions((prev) => {
                  const others = prev.filter((r) => r.id !== newRequest.id);
                  return [newRequest, ...others];
                });
              }}
            />
          ) : (
            <Card className="border-border bg-card shadow-sm h-full flex items-center justify-center p-8 text-center text-muted-foreground font-sans">
              <div className="flex flex-col items-center gap-2 max-w-md">
                <Code2 className="h-8 w-8 text-muted-foreground/60" />
                <h3 className="font-bold text-foreground mt-2">No graded submissions yet</h3>
                <p className="text-sm">
                  If you missed the first grading run, submit a Drive link for admin approval.
                </p>
                <Button className="mt-2" onClick={() => setLateDialogOpen(true)}>
                  Request Late First Submission
                </Button>
              </div>
            </Card>
          )}
        </section>
      </main>

      <Dialog open={lateDialogOpen} onOpenChange={setLateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Late First Submission</DialogTitle>
            <DialogDescription>
              Enter the lab ID and Google Drive link. Admins will review it before the grading tool
              processes your submission.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="flex gap-3 rounded-lg border border-primary/25 bg-primary/[0.04] p-3.5 text-sm leading-relaxed text-foreground ring-1 ring-primary/10">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <TriangleAlert className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-primary">Submission file requirement</p>
                <p className="mt-0.5 text-muted-foreground">
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
            <Input
              value={lateLabId}
              onChange={(event) => setLateLabId(event.target.value)}
              placeholder="Lab2"
              aria-label="Lab ID"
            />
            <Input
              value={lateDriveLink}
              onChange={(event) => setLateDriveLink(event.target.value)}
              placeholder="https://drive.google.com/..."
              aria-label="Google Drive late submission link"
            />
            <Textarea
              value={lateNote}
              onChange={(event) => setLateNote(event.target.value)}
              placeholder="Optional note for admin"
              className="min-h-[96px]"
              aria-label="Late submission note"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLateDialogOpen(false)}
              disabled={savingLateRequest}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveLateRequest}
              disabled={!lateLabId.trim() || !lateDriveLink.trim() || savingLateRequest}
            >
              {savingLateRequest ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Request Grading
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
