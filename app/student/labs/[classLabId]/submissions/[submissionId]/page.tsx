"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, TriangleAlert, CheckCircle2 } from "lucide-react";

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
import { getSubmissionDetailAction } from "@/lib/actions/erd-student";
import type { ClassLabSubmission } from "@/lib/types/erd";

function statusBadge(status: string) {
  if (status === "passed")
    return <Badge className="border-none bg-emerald-500 text-white">Passed</Badge>;
  if (status === "failed")
    return <Badge className="border-none bg-red-600 text-white">Failed</Badge>;
  return <Badge className="border-none bg-amber-500 text-white">Grading</Badge>;
}

function formatResponse(response: string) {
  try {
    return JSON.stringify(JSON.parse(response), null, 2);
  } catch {
    return response;
  }
}

export default function SubmissionDetailPage() {
  const params = useParams<{ classLabId: string; submissionId: string }>();
  const router = useRouter();
  const [submission, setSubmission] = useState<ClassLabSubmission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getSubmissionDetailAction(params.submissionId);
        setSubmission(data);
      } catch (err) {
        console.error("Failed to load submission detail:", err);
        toast.error("Unable to load submission detail.");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.submissionId]);

  const buildLogs = submission?.details?.build_logs || submission?.details?.buildLogs;
  const tests = submission?.details?.tests || [];
  const isErrorBuild =
    !!buildLogs &&
    /error|failed|exception/i.test(buildLogs) &&
    !buildLogs.includes("Build succeeded");

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/student/labs/${params.classLabId}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to attempts
          </Button>
          <h1 className="text-sm font-bold text-foreground">
            Attempt {submission ? `#${submission.attempt_no}` : ""} details
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : !submission ? (
          <Card className="p-6 text-sm text-muted-foreground">Submission not found.</Card>
        ) : (
          <>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                {statusBadge(submission.status)}
                <span className="text-sm text-muted-foreground">
                  Score:{" "}
                  <span className="font-bold text-foreground">
                    {submission.score !== null ? submission.score.toFixed(2) : "—"} / 10
                  </span>
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Submitted at {new Date(submission.submitted_at).toLocaleString()}
              </span>
            </Card>

            {buildLogs ? (
              <div className="space-y-2">
                <h4
                  className={`flex items-center gap-1.5 text-xs font-bold ${
                    isErrorBuild
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {isErrorBuild ? (
                    <TriangleAlert className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Build Diagnostic Logs
                </h4>
                <div
                  className={`rounded-lg border p-4 ${
                    isErrorBuild
                      ? "border-red-200 bg-red-50/50 dark:border-red-950/30 dark:bg-red-950/10"
                      : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-950/30 dark:bg-emerald-950/10"
                  }`}
                >
                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {buildLogs}
                  </pre>
                </div>
              </div>
            ) : null}

            {tests.length > 0 ? (
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Testcase</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tests.map((tc, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="max-w-[300px] truncate text-xs" title={tc.name}>
                          {tc.name}
                        </TableCell>
                        <TableCell>
                          {tc.passed ? (
                            <span className="font-bold text-emerald-500">✓</span>
                          ) : (
                            <span className="font-bold text-red-500">X</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {tc.score !== undefined ? tc.score.toFixed(1) : tc.passed ? "1.0" : "0.0"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : null}

            {tests.some((t) => t.actual_response) ? (
              <div className="space-y-4">
                <h3 className="border-b pb-2 text-base font-bold text-foreground">
                  Response details
                </h3>
                {tests.map((tc, idx) =>
                  tc.actual_response ? (
                    <div key={idx} className="space-y-1.5">
                      <p className="font-mono text-xs font-bold text-muted-foreground">
                        {tc.name}
                      </p>
                      <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
                        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap p-3.5 font-mono text-xs leading-relaxed">
                          {formatResponse(tc.actual_response)}
                        </pre>
                      </div>
                      {!tc.passed && tc.error ? (
                        <p className="text-xs font-semibold text-red-500">{tc.error}</p>
                      ) : null}
                    </div>
                  ) : null
                )}
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
