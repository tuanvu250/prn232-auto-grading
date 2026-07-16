"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import {
  CalendarClock,
  CircleDot,
  ExternalLink,
  FileWarning,
  FolderOpen,
  GraduationCap,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { studentSessionOverviewQueryOptions } from "@/lib/queries/student";
import { removeAuthCookie, type UserPayload } from "@/lib/utils/auth";
import { compareNaturalText } from "@/lib/utils/grading-session";

function resultBadge(status: string | null) {
  if (!status) return <Badge variant="outline">Not submitted</Badge>;
  if (status === "passed")
    return <Badge className="border-none bg-emerald-500 text-white">Passed</Badge>;
  if (status === "failed")
    return <Badge className="border-none bg-red-600 text-white">Failed</Badge>;
  return <Badge className="border-none bg-amber-500 text-white">Grading</Badge>;
}

function deadlineLabel(deadline: string | null) {
  if (!deadline) return "No deadline";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(deadline)
  );
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserPayload | null>(null);
  const { data: sessions = [], error, isPending } = useQuery(studentSessionOverviewQueryOptions());

  useEffect(() => {
    const token = Cookies.get("authToken");
    if (!token) return router.push("/");
    try {
      setUser(jwtDecode<UserPayload>(token));
    } catch {
      queryClient.clear();
      removeAuthCookie();
      router.push("/");
    }
  }, [queryClient, router]);

  useEffect(() => {
    if (error) toast.error("Unable to load your grading sessions.");
  }, [error]);

  const orderedSessions = useMemo(
    () =>
      [...sessions].sort(
        (left, right) =>
          compareNaturalText(left.lab_code, right.lab_code) ||
          compareNaturalText(left.session_name, right.session_name)
      ),
    [sessions]
  );

  const logout = () => {
    queryClient.clear();
    removeAuthCookie();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <GraduationCap className="h-6 w-6 text-primary" />
            <h1 className="text-sm font-bold text-foreground">My grading sessions</h1>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden select-none flex-col items-end leading-tight sm:flex">
                  <span className="text-xs font-bold text-foreground">{user.name}</span>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {user.email} {user.className ? `· ${user.className}` : ""}
                  </span>
                </div>
                {user.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.picture}
                    alt={user.name || "User avatar"}
                    className="pointer-events-none h-8 w-8 select-none rounded-full border border-border"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-8 w-8 select-none items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ) : null}
            <Button size="sm" variant="outline" onClick={logout}>
              <LogOut className="mr-2 h-3.5 w-3.5" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
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
        ) : sessions.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 border-dashed p-10 text-center">
            <FileWarning className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Your lecturer has not opened a grading session for this class yet.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orderedSessions.map((session) => (
              <Card
                key={session.grading_session_id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/student/sessions/${session.grading_session_id}`)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/student/sessions/${session.grading_session_id}`);
                  }
                }}
                className="h-full cursor-pointer space-y-3 p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">
                      {session.session_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {session.lab_code}
                      {session.lab_title ? ` · ${session.lab_title}` : ""}
                    </p>
                  </div>
                  {resultBadge(session.latest_status)}
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    Score:{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {session.latest_score === null ? "—" : session.latest_score.toFixed(2)}
                    </span>
                  </span>
                  <span>
                    {session.attempt_count} attempt{session.attempt_count === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                    {session.session_status === "open" ? (
                      <CircleDot className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="truncate">
                      {session.session_status === "closed"
                        ? "Closed"
                        : deadlineLabel(session.deadline)}
                    </span>
                  </span>
                  {session.drive_root_url ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        window.open(session.drive_root_url || "", "_blank", "noopener,noreferrer");
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
