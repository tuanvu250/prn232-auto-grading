"use client";

import { ChangeEvent } from "react";
import { FileUp, Pencil, RefreshCw, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { TablePagination, PaginationMeta } from "./TablePagination";
import { AllowedEmail, EmptyTableRow } from "./Dialogs";

export interface AccessSummary {
  total: number;
  classes: number;
}

interface StudentAccessPanelProps {
  allowedEmails: AllowedEmail[];
  summary: AccessSummary;
  query: string;
  loading: boolean;
  pagination: PaginationMeta;
  onQueryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onImportCsv: (file: File) => void;
  onEdit: (item: AllowedEmail) => void;
  onDelete: (item: AllowedEmail) => void;
  importing: boolean;
}

export function StudentAccessPanel({
  allowedEmails,
  summary,
  query,
  loading,
  pagination,
  onQueryChange,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onAdd,
  onImportCsv,
  onEdit,
  onDelete,
  importing,
}: StudentAccessPanelProps) {
  const handleCsvChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      onImportCsv(file);
    }
  };

  return (
    <div className="motion-panel space-y-4">
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Inline Metrics */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-muted-foreground">Student Access:</span>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1">
                <span className="text-xs text-muted-foreground">Emails</span>
                <span className="font-extrabold text-foreground">{summary.total}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1">
                <span className="text-xs text-muted-foreground">Classes</span>
                <span className="font-extrabold text-primary">{summary.classes}</span>
              </div>
            </div>

            {/* Search & Actions */}
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center md:justify-end">
              <Input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search email, student ID or class"
                aria-label="Search student access"
                className="max-w-md"
              />

              <div className="flex shrink-0 items-center gap-2">
                <Button asChild variant="outline">
                  <label className={importing ? "pointer-events-none opacity-50" : ""}>
                    {importing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileUp className="h-4 w-4" />
                    )}
                    Import CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={handleCsvChange}
                      disabled={importing}
                    />
                  </label>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onRefresh}
                  disabled={loading}
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button onClick={onAdd}>Add Student</Button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[140px]">MSSV</TableHead>
                    <TableHead className="w-[140px]">Class</TableHead>
                    <TableHead className="w-[170px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4 rounded-full" />
                            <Skeleton className="h-4 w-48" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Skeleton className="h-8 w-10" />
                            <Skeleton className="h-8 w-20" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : allowedEmails.length === 0 ? (
                    <EmptyTableRow
                      colSpan={4}
                      label="No student access records match the current filters."
                    />
                  ) : (
                    allowedEmails.map((item, index) => (
                      <TableRow
                        key={item.email}
                        className="motion-list-item"
                        style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
                      >
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-2">
                            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate font-medium">{item.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.student_id}</TableCell>
                        <TableCell>{item.class_name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => onDelete(item)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete
                            </Button>
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
        </CardContent>
      </Card>
    </div>
  );
}
