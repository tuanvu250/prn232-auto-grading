import Link from "next/link";
import { BookOpenCheck, CircleDot, GraduationCap, Layers3, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type DashboardOverview = {
  metrics: {
    totalStudents: number;
    totalClasses: number;
    totalSessions: number;
    openSessions: number;
    totalSubmissions: number;
  };
  recentSubmissions: Array<{
    student_id: string;
    student_name: string;
    lab_id: string;
    session_name: string;
    class_name: string;
    score: number | null;
    status: string;
    updated_at: string;
  }>;
};

export function OverviewPanel({ data }: { data: DashboardOverview }) {
  const metrics = [
    { label: "Students", value: data.metrics.totalStudents, icon: Users },
    { label: "Classes", value: data.metrics.totalClasses, icon: GraduationCap },
    { label: "Sessions", value: data.metrics.totalSessions, icon: Layers3 },
    { label: "Open now", value: data.metrics.openSessions, icon: CircleDot },
    { label: "Graded attempts", value: data.metrics.totalSubmissions, icon: BookOpenCheck },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grading overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Current normalized data across terms, classes and grading sessions.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/terms">Manage sessions</Link>
        </Button>
      </div>

      <section
        className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-5"
        aria-label="System metrics"
      >
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
              <metric.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 font-mono text-2xl font-bold">{metric.value}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-semibold">Recent grading activity</h2>
            <p className="text-xs text-muted-foreground">
              Latest attempts written to grading sessions
            </p>
          </div>
        </div>
        {data.recentSubmissions.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center border-y border-dashed border-border text-sm text-muted-foreground">
            No graded attempts yet.
          </div>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {data.recentSubmissions.map((submission, index) => (
              <div
                key={`${submission.student_id}-${submission.updated_at}-${index}`}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{submission.student_id}</span>
                    <span className="truncate text-sm">{submission.student_name}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {submission.lab_id}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {submission.class_name} · {submission.session_name}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <Badge
                    variant={submission.status === "failed" ? "destructive" : "outline"}
                    className={
                      submission.status === "passed" ? "text-emerald-700 dark:text-emerald-300" : ""
                    }
                  >
                    {submission.status}
                  </Badge>
                  <span className="w-12 text-right font-mono font-bold">
                    {submission.score === null ? "—" : Number(submission.score).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
