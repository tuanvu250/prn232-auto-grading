"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { toast } from "sonner";
import { LogOut, GraduationCap, RefreshCw, FileWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { removeAuthCookie, UserPayload } from "@/lib/utils/auth";
import { getStudentLabOverviewAction } from "@/lib/actions/erd-student";
import { AttemptResubmissionDialog } from "@/components/student/AttemptResubmissionDialog";
import type { StudentClassLabOverview } from "@/lib/types/erd";

function statusBadge(status: string | null) {
  if (!status) return <Badge variant="outline">Not submitted</Badge>;
  if (status === "passed")
    return <Badge className="border-none bg-emerald-500 text-white">Passed</Badge>;
  if (status === "failed")
    return <Badge className="border-none bg-red-600 text-white">Failed</Badge>;
  return <Badge className="border-none bg-amber-500 text-white">Grading</Badge>;
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserPayload | null>(null);
  const [labs, setLabs] = useState<StudentClassLabOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false);

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
    setLoading(true);
    try {
      const data = await getStudentLabOverviewAction();
      setLabs(data);
    } catch (err) {
      console.error("Failed to load lab overview:", err);
      toast.error("Unable to load your labs.");
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
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-sm font-bold text-foreground">My Labs</h1>
              <p className="text-xs text-muted-foreground">
                {user?.name || user?.email} {user?.className ? `· ${user.className}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setResubmitDialogOpen(true)}>
              Request Resubmission
            </Button>
            <Button size="sm" variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading labs...
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
              <Link key={lab.class_lab_id} href={`/student/labs/${lab.class_lab_id}`}>
                <Card className="h-full space-y-3 p-4 transition-colors hover:border-primary/40">
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
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <AttemptResubmissionDialog
        open={resubmitDialogOpen}
        onOpenChange={setResubmitDialogOpen}
        labs={labs}
        onSaved={loadLabs}
      />
    </div>
  );
}
