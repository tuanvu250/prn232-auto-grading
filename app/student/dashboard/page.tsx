"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { toast } from "sonner";
import { LogOut, GraduationCap, FileWarning, FolderOpen, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { removeAuthCookie, UserPayload } from "@/lib/utils/auth";
import { queryCache } from "@/lib/utils/queryCache";
import { getStudentLabOverviewAction } from "@/lib/actions/erd-student";
import type { StudentClassLabOverview } from "@/lib/types/erd";

function statusBadge(status: string | null) {
  if (!status) return <Badge variant="outline">Not submitted</Badge>;
  if (status === "passed")
    return <Badge className="border-none bg-emerald-500 text-white">Passed</Badge>;
  if (status === "failed")
    return <Badge className="border-none bg-red-600 text-white">Failed</Badge>;
  return <Badge className="border-none bg-amber-500 text-white">Grading</Badge>;
}

function deadlineLabel(deadline: string | null) {
  if (!deadline) return "Late request open";
  const date = new Date(deadline);
  if (!Number.isFinite(date.getTime())) return "Deadline configured";
  const formatted = date.toLocaleString("vi-VN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return date.getTime() > Date.now() ? `Open until ${formatted}` : `Closed ${formatted}`;
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserPayload | null>(null);
  const [labs, setLabs] = useState<StudentClassLabOverview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get("authToken");
    if (!token) {
      router.push("/");
      return;
    }
    try {
      setUser(jwtDecode<UserPayload>(token));
    } catch {
      toast.error("Invalid session. Please sign in again.");
      removeAuthCookie();
      router.push("/");
    }
  }, [router]);

  const loadLabs = useCallback(async () => {
    const cached = queryCache.get<StudentClassLabOverview[]>("student-labs", 60000); // 1 minute stale time
    if (cached.data) {
      setLabs(cached.data);
      setLoading(false);
      if (!cached.isStale) {
        return;
      }
    } else {
      setLoading(true);
    }

    try {
      const data = await getStudentLabOverviewAction();
      setLabs(data);
      queryCache.set("student-labs", data);
    } catch (err) {
      console.error("Failed to load lab overview:", err);
      if (!cached.data) {
        toast.error("Unable to load your labs.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadLabs();
  }, [user, loadLabs]);

  const handleLogout = () => {
    removeAuthCookie();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <GraduationCap className="h-6 w-6 text-primary" />
            <h1 className="text-sm font-bold text-foreground">My Labs</h1>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end leading-tight select-none">
                  <span className="text-xs font-bold text-foreground">
                    {user.name}
                  </span>
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

            <Button size="sm" variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Card key={idx} className="space-y-4 p-4 animate-pulse">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              </Card>
            ))}
          </div>
        ) : labs.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 border-dashed p-10 text-center">
            <FileWarning className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No labs assigned to your class yet.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {labs.map((lab) => (
              <Card
                key={lab.class_lab_id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/student/labs/${lab.class_lab_id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/student/labs/${lab.class_lab_id}`);
                  }
                }}
                className="h-full cursor-pointer space-y-3 p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{lab.lab_code}</p>
                      {lab.lab_title ? (
                        <p className="truncate text-xs text-muted-foreground">{lab.lab_title}</p>
                      ) : null}
                    </div>
                    {statusBadge(lab.latest_status)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Score:{" "}
                      <span className="font-semibold text-foreground">
                        {lab.latest_score !== null ? lab.latest_score.toFixed(2) : "—"}
                      </span>
                    </span>
                    <span>{lab.attempt_count} attempt(s)</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                    <span className="truncate">{deadlineLabel(lab.deadline)}</span>
                    {lab.drive_root_url ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          window.open(lab.drive_root_url || "", "_blank", "noopener,noreferrer");
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 font-semibold text-foreground hover:border-primary/40 hover:text-primary"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Drive
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
              </Card>
            ))}
          </div>
        )}
      </main>

    </div>
  );
}
