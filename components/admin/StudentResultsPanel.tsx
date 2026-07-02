"use client";

import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Layers3,
  RefreshCw,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "./Dialogs";
import { PaginationMeta, TablePagination } from "./TablePagination";

export interface StudentResultRow {
  email: string;
  student_id: string;
  class_name: string;
  lab_id: string;
  score: number | null;
  raw_status: string | null;
  status: "Passed" | "Failed" | "Grading" | "Not Submitted";
  updated_at: string | null;
}

export interface StudentResultSummary {
  total: number;
  submitted: number;
  notSubmitted: number;
  passed: number;
  failed: number;
  grading: number;
  averageScore: number | null;
}

interface StudentResultsPanelProps {
  classes: string[];
  labs: string[];
  selectedClass: string;
  selectedLab: string;
  query: string;
  rows: StudentResultRow[];
  summary: StudentResultSummary;
  loadingFilters: boolean;
  loadingResults: boolean;
  pagination: PaginationMeta;
  onClassChange: (value: string) => void;
  onLabChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRefresh: () => void;
  onBackToClasses: () => void;
  onBackToLabs: () => void;
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return dateStr;
  }
};

function ResultStatusBadge({ status }: { status: StudentResultRow["status"] }) {
  if (status === "Passed") {
    return (
      <Badge className="border-none bg-emerald-600 text-white hover:bg-emerald-700">Passed</Badge>
    );
  }

  if (status === "Failed") {
    return <Badge className="border-none bg-red-600 text-white hover:bg-red-700">Failed</Badge>;
  }

  if (status === "Grading") {
    return (
      <Badge className="border-none bg-amber-500 text-white hover:bg-amber-600">Grading</Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
      Not Submitted
    </Badge>
  );
}

function SummaryChip({
  label,
  value,
  valueClassName = "text-foreground",
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-extrabold ${valueClassName}`}>{value}</span>
    </div>
  );
}

function ChoiceCard({
  active,
  icon,
  title,
  description,
  onClick,
  index,
  mono = false,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  index: number;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      className={`motion-list-item flex min-h-24 items-start justify-between gap-3 rounded-lg border p-4 text-left transition-all duration-150 active:scale-[0.99] ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
      }`}
      style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
      aria-pressed={active}
      onClick={onClick}
    >
      <div className="min-w-0">
        <div
          className={`mb-3 flex h-8 w-8 items-center justify-center rounded-md ${
            active ? "bg-primary-foreground/15" : "bg-primary/10 text-primary"
          }`}
        >
          {icon}
        </div>
        <p className={`break-words text-base font-extrabold ${mono ? "font-mono text-sm" : ""}`}>
          {title}
        </p>
        <p
          className={
            active
              ? "mt-1 text-xs text-primary-foreground/75"
              : "mt-1 text-xs text-muted-foreground"
          }
        >
          {description}
        </p>
      </div>
      <ChevronRight
        className={`mt-1 h-4 w-4 shrink-0 ${
          active ? "text-primary-foreground" : "text-muted-foreground"
        }`}
      />
    </button>
  );
}

export function StudentResultsPanel({
  classes,
  labs,
  selectedClass,
  selectedLab,
  query,
  rows,
  summary,
  loadingFilters,
  loadingResults,
  pagination,
  onClassChange,
  onLabChange,
  onQueryChange,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onBackToClasses,
  onBackToLabs,
}: StudentResultsPanelProps) {
  const currentStep = selectedLab ? "detail" : selectedClass ? "labs" : "classes";

  return (
    <section className="motion-panel space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <nav
          aria-label="Student results path"
          className="flex min-w-0 flex-wrap items-center gap-1 text-sm"
        >
          <button
            type="button"
            onClick={onBackToClasses}
            className={`rounded-md px-2 py-1 font-semibold transition-colors ${
              currentStep === "classes"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-current={currentStep === "classes" ? "step" : undefined}
          >
            Classes
          </button>
          {selectedClass ? (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <button
                type="button"
                onClick={onBackToLabs}
                className={`max-w-[180px] truncate rounded-md px-2 py-1 font-semibold transition-colors sm:max-w-[260px] ${
                  currentStep === "labs"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-current={currentStep === "labs" ? "step" : undefined}
                title={selectedClass}
              >
                {selectedClass}
              </button>
            </>
          ) : null}
          {selectedLab ? (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span
                className="max-w-[200px] truncate rounded-md bg-primary/10 px-2 py-1 font-mono text-xs font-extrabold text-primary sm:max-w-[360px]"
                aria-current="step"
                title={selectedLab}
              >
                {selectedLab}
              </span>
            </>
          ) : null}
        </nav>

        {selectedClass ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectedLab ? onBackToLabs : onBackToClasses}
            className="w-fit"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        ) : null}
      </div>

      {!selectedClass ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold tracking-tight">1. Choose class</h2>
              <p className="text-sm text-muted-foreground">
                Start from a class, then narrow down to a lab.
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={loadingFilters || loadingResults}
              title="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${loadingFilters || loadingResults ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {loadingFilters ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-border bg-card p-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-3 h-3 w-36" />
                </div>
              ))
            ) : classes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card p-5 text-sm text-muted-foreground sm:col-span-2 xl:col-span-4">
                No classes are available yet.
              </div>
            ) : (
              classes.map((className, index) => (
                <ChoiceCard
                  key={className}
                  active={false}
                  icon={<Users className="h-4 w-4" />}
                  title={className}
                  description="View labs in this class"
                  index={index}
                  onClick={() => onClassChange(className)}
                />
              ))
            )}
          </div>
        </div>
      ) : null}

      {selectedClass && !selectedLab ? (
        <div className="space-y-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight">2. Choose lab</h2>
            <p className="text-sm text-muted-foreground">
              Showing lab IDs detected for {selectedClass}.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {loadingFilters ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-border bg-card p-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-3 h-3 w-20" />
                </div>
              ))
            ) : labs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card p-5 text-sm text-muted-foreground sm:col-span-2 xl:col-span-4">
                No lab IDs have been submitted for this class yet.
              </div>
            ) : (
              labs.map((labId, index) => (
                <ChoiceCard
                  key={labId}
                  active={false}
                  icon={<Layers3 className="h-4 w-4" />}
                  title={labId}
                  description="Open detail table"
                  index={index}
                  mono
                  onClick={() => onLabChange(labId)}
                />
              ))
            )}
          </div>
        </div>
      ) : null}

      {selectedClass && selectedLab ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-muted-foreground">3. Detail table:</span>
              <SummaryChip label="Students" value={summary.total} />
              <SummaryChip
                label="Submitted"
                value={summary.submitted}
                valueClassName="text-primary"
              />
              <SummaryChip
                label="Passed"
                value={summary.passed}
                valueClassName="text-emerald-600"
              />
              <SummaryChip label="Failed" value={summary.failed} valueClassName="text-red-600" />
              <SummaryChip
                label="Missing"
                value={summary.notSubmitted}
                valueClassName="text-muted-foreground"
              />
              <SummaryChip
                label="Average"
                value={summary.averageScore === null ? "--" : summary.averageScore.toFixed(2)}
              />
            </div>

            <div className="relative flex-1 xl:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search MSSV or email"
                aria-label="Search student results"
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <Table className="min-w-[920px]">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Student</TableHead>
                    <TableHead className="w-[120px]">Class</TableHead>
                    <TableHead className="w-[220px]">Lab</TableHead>
                    <TableHead className="w-[110px] text-right">Score</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[150px]">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingResults ? (
                    Array.from({ length: 6 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-52" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-12" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-24 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <EmptyTableRow
                      colSpan={6}
                      label="No students match the current class, lab, and search filters."
                    />
                  ) : (
                    rows.map((row, index) => (
                      <TableRow
                        key={`${row.student_id}-${row.lab_id}`}
                        className="motion-list-item"
                        style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
                      >
                        <TableCell>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {row.status === "Passed" ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : row.status === "Failed" ? (
                                <XCircle className="h-4 w-4 text-red-600" />
                              ) : row.status === "Not Submitted" ? (
                                <CircleSlash className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <BarChart3 className="h-4 w-4 text-amber-600" />
                              )}
                              <span className="font-semibold">{row.student_id}</span>
                            </div>
                            <p className="mt-0.5 max-w-[320px] truncate text-xs text-muted-foreground">
                              {row.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{row.class_name}</TableCell>
                        <TableCell className="font-mono text-xs">{row.lab_id}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-bold">
                          {row.score === null ? "--" : `${row.score.toFixed(2)}/10`}
                        </TableCell>
                        <TableCell>
                          <ResultStatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(row.updated_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <TablePagination
            pagination={pagination}
            loading={loadingResults}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      ) : null}
    </section>
  );
}
