"use client";

import React from "react";
import {
  Users,
  GraduationCap,
  FileSpreadsheet,
  Clock,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatDistanceToNow } from "date-fns";

type DashboardMetrics = {
  totalStudents: number;
  totalClasses: number;
  totalSubmissions: number;
  pendingResubmissions: number;
};

type GradeDistribution = {
  name: string;
  pass: number;
  fail: number;
};

type RecentResubmission = {
  id: string;
  student_id: string;
  name: string;
  class_name: string;
  lab_id: string;
  drive_link: string;
  note?: string | null;
  status: string;
  updated_at: string;
};

type RecentSubmission = {
  student_id: string;
  student_name: string;
  lab_id: string;
  class_name: string;
  score: number | string;
  status: string;
  updated_at: string;
};

interface OverviewPanelProps {
  metrics: DashboardMetrics;
  gradeDistribution: GradeDistribution[];
  recentResubmissions: RecentResubmission[];
  recentSubmissions: RecentSubmission[];
  onViewChange: (view: "resubmissions" | "studentAccess") => void;
}

export function OverviewPanel({
  metrics,
  gradeDistribution,
  recentResubmissions,
  recentSubmissions,
  onViewChange,
}: OverviewPanelProps) {
  const metricCards = [
    {
      title: "Students Whitelisted",
      value: metrics.totalStudents,
      icon: Users,
      description: "Active Google accounts",
      onClick: () => onViewChange("studentAccess"),
      colorClass: "text-blue-500 bg-blue-50 dark:bg-blue-950/20",
    },
    {
      title: "Total Classes",
      value: metrics.totalClasses,
      icon: GraduationCap,
      description: "Classrooms in current term",
      colorClass: "text-purple-500 bg-purple-50 dark:bg-purple-950/20",
    },
    {
      title: "Total Lab Submissions",
      value: metrics.totalSubmissions,
      icon: FileSpreadsheet,
      description: "Graded by auto-grader",
      colorClass: "text-green-500 bg-green-50 dark:bg-green-950/20",
    },
    {
      title: "Pending Resubmissions",
      value: metrics.pendingResubmissions,
      icon: Clock,
      description: "Awaiting teacher review",
      onClick: () => onViewChange("resubmissions"),
      colorClass: "text-orange-500 bg-orange-50 dark:bg-orange-950/20 animate-pulse-subtle",
    },
  ];

  const formatTime = (timeString: string) => {
    try {
      return formatDistanceToNow(new Date(timeString), { addSuffix: true });
    } catch {
      return timeString;
    }
  };

  return (
    <div className="space-y-6 font-quicksand">
      {/* Page Title */}
      <div>
        <h1 className="font-open-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Dashboard Overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-time summary of students, classes, and lab evaluations.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card, idx) => {
          const CardIcon = card.icon;
          const content = (
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {card.title}
                </p>
                <p className="text-2xl font-bold font-open-sans tracking-tight">
                  {card.value}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {card.description}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${card.colorClass}`}>
                <CardIcon className="h-5 w-5" />
              </div>
            </div>
          );

          if (card.onClick) {
            return (
              <button
                key={idx}
                onClick={card.onClick}
                className="block text-left p-6 bg-card border border-border rounded-lg transition-all duration-150 hover:shadow-sm hover:border-primary/50 group cursor-pointer"
              >
                {content}
                <div className="mt-4 flex items-center justify-end text-xs text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  Manage <ChevronRight className="h-3 w-3 ml-0.5" />
                </div>
              </button>
            );
          }

          return (
            <div
              key={idx}
              className="p-6 bg-card border border-border rounded-lg"
            >
              {content}
              <div className="mt-4 h-4" /> {/* Spacer to keep same height */}
            </div>
          );
        })}
      </div>

      {/* Main Charts & Analytics Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recharts Bar Chart */}
        <div className="lg:col-span-2 p-6 bg-card border border-border rounded-lg flex flex-col">
          <div className="mb-4">
            <h2 className="font-open-sans text-base font-bold text-foreground">
              Grade Distribution by Class
            </h2>
            <p className="text-xs text-muted-foreground">
              Number of Passed vs Failed lab submissions per class.
            </p>
          </div>
          <div className="h-[300px] w-full flex-1 min-h-[250px]">
            {gradeDistribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No grading data available to display.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={gradeDistribution}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    className="font-mono"
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    className="font-mono"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      borderColor: "var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontFamily: "var(--font-quicksand)",
                    }}
                    cursor={{ fill: "rgba(234, 88, 12, 0.05)" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                    iconType="circle"
                  />
                  <Bar
                    dataKey="pass"
                    name="Passed (Score >= 5)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                  <Bar
                    dataKey="fail"
                    name="Failed (Score < 5)"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Quick stats / info */}
        <div className="p-6 bg-card border border-border rounded-lg flex flex-col justify-between">
          <div>
            <h2 className="font-open-sans text-base font-bold text-foreground mb-1">
              Diagnostic Status
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Overview of the auto-grader service and database status.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold">Auto-Grader Engine</p>
                  <p className="text-[10px] text-muted-foreground">Local script evaluator</p>
                </div>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold">Supabase Connection</p>
                  <p className="text-[10px] text-muted-foreground">Postgres database synced</p>
                </div>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold">Active Lab Count</p>
                  <p className="text-[10px] text-muted-foreground">Configured in terms</p>
                </div>
                <p className="text-xs font-bold font-mono">5 Labs</p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/60">
            <button
              onClick={() => onViewChange("resubmissions")}
              className="w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <span>Review pending requests ({metrics.pendingResubmissions})</span>
              <Clock className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activities Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Column 1: Recent Resubmission Requests */}
        <div className="p-6 bg-card border border-border rounded-lg">
          <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
            <div>
              <h3 className="font-open-sans text-sm font-bold text-foreground">
                Recent Resubmissions
              </h3>
              <p className="text-xs text-muted-foreground">
                Latest student requests for lab re-evaluations.
              </p>
            </div>
            <button
              onClick={() => onViewChange("resubmissions")}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          {recentResubmissions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No resubmission requests recorded.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentResubmissions.map((req) => (
                <div key={req.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs truncate max-w-[150px]">
                        {req.name || "Student"}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ({req.student_id})
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Requested <span className="font-bold text-foreground">{req.lab_id.toUpperCase()}</span> for class <span className="font-semibold text-foreground">{req.class_name}</span>
                    </p>
                    {req.note && (
                      <p className="text-[11px] bg-muted/40 text-muted-foreground px-2 py-1 rounded italic truncate max-w-full">
                        "{req.note}"
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(req.updated_at)}
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={req.drive_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-primary"
                        title="Google Drive Link"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          req.status === "pending"
                            ? "text-amber-600 dark:text-amber-400"
                            : req.status === "approved"
                              ? "text-blue-600 dark:text-blue-400"
                              : req.status === "rejected"
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Recent Auto-Grader Submissions */}
        <div className="p-6 bg-card border border-border rounded-lg">
          <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
            <div>
              <h3 className="font-open-sans text-sm font-bold text-foreground">
                Recent Submissions
              </h3>
              <p className="text-xs text-muted-foreground">
                Latest student submissions evaluated by the system.
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Live Feed
            </span>
          </div>

          {recentSubmissions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No submissions found.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentSubmissions.map((sub, idx) => {
                const isPassed = sub.status === "Passed";
                return (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs truncate max-w-[150px]">
                          {sub.student_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({sub.student_id})
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Submitted <span className="font-bold text-foreground">{sub.lab_id.toUpperCase()}</span> in class <span className="font-semibold text-foreground">{sub.class_name}</span>
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(sub.updated_at)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold">
                          {sub.score !== null && sub.score !== undefined ? `${sub.score}/10` : "-"}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            isPassed
                              ? "text-green-600 dark:text-green-400"
                              : sub.status === "Grading"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
