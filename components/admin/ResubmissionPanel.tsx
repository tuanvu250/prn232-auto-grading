"use client";

import { CheckCircle2, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination, PaginationMeta } from "./TablePagination";
import { ResubmissionRequest, StatusBadge, EmptyTableRow } from "./Dialogs";

export interface ResubmissionSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
}

interface ResubmissionPanelProps {
  requests: ResubmissionRequest[];
  stats: ResubmissionSummary;
  status: string;
  query: string;
  loading: boolean;
  updatingId: string | null;
  pagination: PaginationMeta;
  onStatusChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRefresh: () => void;
  onApprove: (id: string) => void;
  onComplete: (id: string) => void;
  onReject: (request: ResubmissionRequest) => void;
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

const metricChipClass =
  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-left transition-all duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60";

function getMetricChipClass(active: boolean) {
  return active
    ? `${metricChipClass} border-primary bg-primary text-primary-foreground`
    : `${metricChipClass} border-border bg-muted/50 hover:border-primary/40 hover:bg-muted hover:text-foreground`;
}

export function ResubmissionPanel({
  requests,
  stats,
  status,
  query,
  loading,
  updatingId,
  pagination,
  onStatusChange,
  onQueryChange,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onApprove,
  onComplete,
  onReject,
}: ResubmissionPanelProps) {
  return (
    <section className="motion-panel flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Inline Metrics */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-muted-foreground">Resubmit Requests:</span>
          <button
            type="button"
            className={getMetricChipClass(status === "all")}
            aria-pressed={status === "all"}
            onClick={() => onStatusChange("all")}
            disabled={loading}
          >
            <span
              className={
                status === "all"
                  ? "text-xs text-primary-foreground/80"
                  : "text-xs text-muted-foreground"
              }
            >
              Showing
            </span>
            <span
              className={
                status === "all"
                  ? "font-extrabold text-primary-foreground"
                  : "font-extrabold text-foreground"
              }
            >
              {stats.total}
            </span>
          </button>
          <button
            type="button"
            className={getMetricChipClass(status === "pending")}
            aria-pressed={status === "pending"}
            onClick={() => onStatusChange("pending")}
            disabled={loading}
          >
            <span
              className={
                status === "pending"
                  ? "text-xs text-primary-foreground/80"
                  : "text-xs text-muted-foreground"
              }
            >
              Pending
            </span>
            <span
              className={
                status === "pending"
                  ? "font-extrabold text-primary-foreground"
                  : "font-extrabold text-amber-600"
              }
            >
              {stats.pending}
            </span>
          </button>
          <button
            type="button"
            className={getMetricChipClass(status === "approved")}
            aria-pressed={status === "approved"}
            onClick={() => onStatusChange("approved")}
            disabled={loading}
          >
            <span
              className={
                status === "approved"
                  ? "text-xs text-primary-foreground/80"
                  : "text-xs text-muted-foreground"
              }
            >
              Approved
            </span>
            <span
              className={
                status === "approved"
                  ? "font-extrabold text-primary-foreground"
                  : "font-extrabold text-emerald-600"
              }
            >
              {stats.approved}
            </span>
          </button>
          <button
            type="button"
            className={getMetricChipClass(status === "rejected")}
            aria-pressed={status === "rejected"}
            onClick={() => onStatusChange("rejected")}
            disabled={loading}
          >
            <span
              className={
                status === "rejected"
                  ? "text-xs text-primary-foreground/80"
                  : "text-xs text-muted-foreground"
              }
            >
              Rejected
            </span>
            <span
              className={
                status === "rejected"
                  ? "font-extrabold text-primary-foreground"
                  : "font-extrabold text-red-600"
              }
            >
              {stats.rejected}
            </span>
          </button>
          <button
            type="button"
            className={getMetricChipClass(status === "completed")}
            aria-pressed={status === "completed"}
            onClick={() => onStatusChange("completed")}
            disabled={loading}
          >
            <span
              className={
                status === "completed"
                  ? "text-xs text-primary-foreground/80"
                  : "text-xs text-muted-foreground"
              }
            >
              Completed
            </span>
            <span
              className={
                status === "completed"
                  ? "font-extrabold text-primary-foreground"
                  : "font-extrabold text-sky-600"
              }
            >
              {stats.completed}
            </span>
          </button>
        </div>

        {/* Filter, Search & Actions */}
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          <div className="w-full sm:w-[160px]">
            <Select value={status} onValueChange={onStatusChange}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search student ID, email, class or lab"
            aria-label="Search resubmission requests"
            className="flex-1 max-w-md"
          />

          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh"
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[138px]">Updated</TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="w-[110px]">Class</TableHead>
                <TableHead className="w-[110px]">Lab</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[112px]">Status</TableHead>
                <TableHead className="w-[330px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-44" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-10" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : requests.length === 0 ? (
                <EmptyTableRow colSpan={7} label="No requests match the current filters." />
              ) : (
                requests.map((request, index) => (
                  <TableRow
                    key={request.id}
                    className="motion-list-item"
                    style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(request.updated_at)}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-semibold">{request.student_id}</p>
                        <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                          {request.name || request.email}
                        </p>
                        <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                          {request.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{request.class_name || "N/A"}</TableCell>
                    <TableCell className="font-mono text-xs">{request.lab_id}</TableCell>
                    <TableCell>
                      <div className="max-w-[300px] space-y-1 text-sm">
                        <p className="truncate text-muted-foreground" title={request.note || ""}>
                          <span className="font-medium text-foreground">Student:</span>{" "}
                          {request.note || "-"}
                        </p>
                        {request.admin_note ? (
                          <p
                            className="truncate text-red-700 dark:text-red-300"
                            title={request.admin_note}
                          >
                            <span className="font-medium">Admin:</span> {request.admin_note}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={request.drive_link} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                            Drive
                          </a>
                        </Button>
                        {request.status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              disabled={updatingId === request.id}
                              onClick={() => onApprove(request.id)}
                            >
                              {updatingId === request.id ? (
                                <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                              )}
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={updatingId === request.id}
                              onClick={() => onReject(request)}
                            >
                              <XCircle className="mr-2 h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </>
                        ) : null}
                        {request.status === "approved" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingId === request.id}
                            onClick={() => onComplete(request.id)}
                          >
                            {updatingId === request.id ? (
                              <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                            )}
                            Complete
                          </Button>
                        ) : null}
                      </div>
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
        loading={loading}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}
