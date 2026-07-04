"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getClassLabAttemptsAction,
  getResubmissionRequestForClassLabAction,
} from "@/lib/actions/erd-student";
import type { ClassLabSubmission, ResubmissionRequestV2 } from "@/lib/types/erd";

function statusBadge(status: string) {
  if (status === "passed")
    return <Badge className="border-none bg-emerald-500 text-white">Passed</Badge>;
  if (status === "failed")
    return <Badge className="border-none bg-red-600 text-white">Failed</Badge>;
  return <Badge className="border-none bg-amber-500 text-white">Grading</Badge>;
}

function itemTypeBadge(itemType: string) {
  if (itemType === "resubmit") return <Badge variant="outline">Resubmit</Badge>;
  if (itemType === "late") return <Badge variant="outline">Late</Badge>;
  return <Badge variant="outline">Original</Badge>;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export default function ClassLabAttemptsPage() {
  const params = useParams<{ classLabId: string }>();
  const router = useRouter();
  const [attempts, setAttempts] = useState<ClassLabSubmission[]>([]);
  const [request, setRequest] = useState<ResubmissionRequestV2 | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [attemptRows, requestRow] = await Promise.all([
        getClassLabAttemptsAction(params.classLabId),
        getResubmissionRequestForClassLabAction(params.classLabId),
      ]);
      setAttempts(attemptRows);
      setRequest(requestRow);
    } catch (err) {
      console.error("Failed to load attempt history:", err);
      toast.error("Unable to load attempt history.");
    } finally {
      setLoading(false);
    }
  }, [params.classLabId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          <Button size="sm" variant="ghost" onClick={() => router.push("/student/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <h1 className="text-sm font-bold text-foreground">Attempt History</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {request ? (
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-foreground">
                Latest resubmission request
              </span>
              <Badge
                className={
                  request.status === "pending"
                    ? "border-none bg-amber-500 text-white"
                    : request.status === "approved"
                      ? "border-none bg-emerald-500 text-white"
                      : request.status === "completed"
                        ? "border-none bg-sky-600 text-white"
                        : "border-none bg-red-600 text-white"
                }
              >
                {request.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Last updated: {formatDate(request.updated_at)}
            </p>
            {request.admin_note ? (
              <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-200">
                Admin note: {request.admin_note}
              </p>
            ) : null}
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading attempts...
            </div>
          ) : attempts.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No submissions yet for this lab.</p>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted at</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="font-semibold">#{attempt.attempt_no}</TableCell>
                    <TableCell>{itemTypeBadge(attempt.item_type)}</TableCell>
                    <TableCell>{attempt.score !== null ? attempt.score.toFixed(2) : "—"}</TableCell>
                    <TableCell>{statusBadge(attempt.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(attempt.submitted_at)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/student/labs/${params.classLabId}/submissions/${attempt.id}`}>
                        <Button size="sm" variant="outline">
                          View details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </main>
    </div>
  );
}
