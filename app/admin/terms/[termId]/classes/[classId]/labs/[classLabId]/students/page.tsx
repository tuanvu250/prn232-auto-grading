"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Users } from "lucide-react";

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
import { getClassLabStudentResultsAction } from "@/lib/actions/erd-admin";
import type { ClassLabStudentResult } from "@/lib/types/erd";

function statusBadge(status: string | null) {
  if (!status) return <Badge variant="outline">Not submitted</Badge>;
  if (status === "passed")
    return <Badge className="border-none bg-emerald-500 text-white">Passed</Badge>;
  if (status === "failed")
    return <Badge className="border-none bg-red-600 text-white">Failed</Badge>;
  return <Badge className="border-none bg-amber-500 text-white">Grading</Badge>;
}

export default function AdminClassLabStudentsPage() {
  const params = useParams<{ termId: string; classId: string; classLabId: string }>();
  const router = useRouter();
  const [results, setResults] = useState<ClassLabStudentResult[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResults(await getClassLabStudentResultsAction(params.classLabId));
    } catch (err) {
      console.error("Failed to load student results:", err);
      toast.error("Unable to load student results.");
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
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-4 sm:px-6">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              router.push(`/admin/terms/${params.termId}/classes/${params.classId}/labs`)
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Labs
          </Button>
          <Users className="h-5 w-5 text-primary" />
          <h1 className="text-sm font-bold text-foreground">Student Results</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : results.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No students enrolled in this class.</p>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Resubmits</TableHead>
                  <TableHead>Latest score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row) => (
                  <TableRow key={row.class_student_id}>
                    <TableCell className="font-semibold">
                      {row.student_code} {row.student_name ? `— ${row.student_name}` : ""}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.student_email}
                    </TableCell>
                    <TableCell>{row.attempt_count}</TableCell>
                    <TableCell>
                      <Badge variant={row.resubmit_count > 0 ? "default" : "outline"}>
                        {row.resubmit_count}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.latest_score !== null ? row.latest_score.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell>{statusBadge(row.latest_status)}</TableCell>
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
