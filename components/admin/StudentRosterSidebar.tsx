"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileSpreadsheet, Search, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { ImportStudentsExcelDialog } from "@/components/admin/ImportStudentsExcelDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { removeClassStudentAction } from "@/lib/actions/erd-admin";
import type { ClassStudentRosterRow } from "@/lib/types/erd";

type StudentRosterSidebarProps = {
  classId: string;
  className: string;
  students: ClassStudentRosterRow[];
  loading?: boolean;
  onRosterImported: () => Promise<unknown> | unknown;
};

function initials(student: ClassStudentRosterRow) {
  const source = student.student_name?.trim() || student.student_code;
  return source
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function StudentRosterSidebar({
  classId,
  className,
  students,
  loading = false,
  onRosterImported,
}: StudentRosterSidebarProps) {
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ClassStudentRosterRow | null>(null);

  const removeMutation = useMutation({
    mutationFn: (student: ClassStudentRosterRow) =>
      removeClassStudentAction(classId, student.class_student_id),
    onSuccess: async (_, student) => {
      setRemoveTarget(null);
      await onRosterImported();
      toast.success(`${student.student_code} was removed from ${className}.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to remove student from class.");
    },
  });

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return students;
    return students.filter((student) =>
      [student.student_code, student.student_name, student.student_email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized))
    );
  }, [query, students]);

  return (
    <>
      <aside className="order-first min-w-0 border-y border-border bg-card lg:order-last lg:h-full lg:min-h-0 lg:border-y-0 lg:border-l">
        <div className="flex h-full min-h-0 flex-col px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Class roster</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {students.length} student{students.length === 1 ? "" : "s"} in this class
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              onClick={() => setImportOpen(true)}
            >
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Import
            </Button>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search students"
              aria-label="Search class roster"
              className="h-9 pl-8 text-sm"
            />
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:pb-0 lg:pr-1">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-14 min-w-72 animate-pulse rounded-lg bg-muted lg:min-w-0"
                />
              ))
            ) : filteredStudents.length ? (
              filteredStudents.map((student) => (
                <div
                  key={student.class_student_id}
                  className="group min-w-72 rounded-lg border border-border bg-background p-2 lg:min-w-0"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-foreground">
                      {initials(student)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs font-semibold">
                        {student.student_code}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {student.student_name || student.student_email}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-focus-within:opacity-100"
                      aria-label={`Remove ${student.student_code} from class`}
                      title="Remove student from class"
                      onClick={() => setRemoveTarget(student)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex min-h-28 min-w-72 flex-col items-center justify-center gap-2 border-y border-dashed border-border px-4 text-center lg:min-w-0">
                <UserRound className="h-5 w-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {students.length
                    ? "No students match this search."
                    : "No students in this class."}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <ImportStudentsExcelDialog
        classId={classId}
        className={className}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={onRosterImported}
      />

      <AlertDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open && !removeMutation.isPending) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove student from {className}?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.student_code} will be removed from this class. Their submissions and
              results in this class will also be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (removeTarget) removeMutation.mutate(removeTarget);
              }}
            >
              {removeMutation.isPending ? "Removing..." : "Remove student"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
