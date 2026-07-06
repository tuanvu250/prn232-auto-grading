"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Calendar as CalendarIcon, Code2, Plus, X, Pencil, Trash2, FileSpreadsheet, Upload, RefreshCw, Search, Users, FolderOpen, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/admin/TablePagination";
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
import {
  getClassLabsForClassAction,
  getLabCatalogAction,
  createLabAction,
  assignLabToClassAction,
  getClassesForTermAction,
  getTermsAction,
  updateClassLabDeadlineAction,
  deleteClassLabAction,
  getClassStudentsForClassAction,
  importClassStudentsAction,
} from "@/lib/actions/erd-admin";
import type { ClassLab, ClassStudentRosterRow, Lab } from "@/lib/types/erd";

function getDeadlineBadge(deadlineStr: string | null) {
  if (!deadlineStr) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-dashed border-border">
        No deadline
      </span>
    );
  }
  try {
    const deadline = new Date(deadlineStr);
    const isPast = deadline.getTime() < Date.now();
    const formatted = deadline.toLocaleString("vi-VN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isPast) {
      return (
        <span className="inline-flex items-center rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
          Expired: {formatted}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
        Due: {formatted}
      </span>
    );
  } catch {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border">
        {deadlineStr}
      </span>
    );
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type SheetGrid = string[][];
type ColumnMapping = {
  studentCode: string;
  email: string;
  name: string;
};

type ImportPreviewRow = {
  rowNumber: number;
  studentCode: string;
  email: string;
  name: string;
  errors: string[];
};

const emptyMapping: ColumnMapping = {
  studentCode: "",
  email: "",
  name: "",
};
const NO_COLUMN_VALUE = "__no_column__";

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ");
}

function autoDetectMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((header) => normalizeHeader(header));

  const findHeader = (candidates: string[]) => {
    const exactIndex = normalized.findIndex((header) => candidates.includes(header));
    if (exactIndex >= 0) return headers[exactIndex];

    const fuzzyIndex = normalized.findIndex((header) =>
      candidates.some((candidate) => header.includes(candidate))
    );
    return fuzzyIndex >= 0 ? headers[fuzzyIndex] : "";
  };

  return {
    studentCode: findHeader(["student code", "student id", "studentid", "mssv", "ma sv", "masv", "code"]),
    email: findHeader(["email", "mail", "student email"]),
    name: findHeader(["full name", "student name", "name", "ho ten", "hoten"]),
  };
}

function buildImportPreview(
  rows: SheetGrid,
  headers: string[],
  headerRow: number,
  mapping: ColumnMapping
): ImportPreviewRow[] {
  const columnIndex = {
    studentCode: headers.indexOf(mapping.studentCode),
    email: headers.indexOf(mapping.email),
    name: headers.indexOf(mapping.name),
  };
  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();

  return rows.slice(headerRow).map((row, index) => {
    const studentCode = String(row[columnIndex.studentCode] || "").trim().toUpperCase();
    const email = String(row[columnIndex.email] || "").trim().toLowerCase();
    const name = String(row[columnIndex.name] || "").trim();
    const errors: string[] = [];

    if (!studentCode) errors.push("Missing student code");
    if (!email) errors.push("Missing email");
    if (!name) errors.push("Missing full name");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Invalid email");
    if (studentCode && seenCodes.has(studentCode)) errors.push("Duplicate student code");
    if (email && seenEmails.has(email)) errors.push("Duplicate email");

    if (studentCode) seenCodes.add(studentCode);
    if (email) seenEmails.add(email);

    return {
      rowNumber: index + 1,
      studentCode,
      email,
      name,
      errors,
    };
  });
}

export default function AdminClassLabsPage() {
  const params = useParams<{ termId: string; classId: string }>();
  const [classLabs, setClassLabs] = useState<ClassLab[]>([]);
  const [students, setStudents] = useState<ClassStudentRosterRow[]>([]);
  const [catalog, setCatalog] = useState<Lab[]>([]);
  const [termName, setTermName] = useState("");
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [existingLabId, setExistingLabId] = useState("");
  const [newLabCode, setNewLabCode] = useState("");
  const [newLabTitle, setNewLabTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [driveRootUrl, setDriveRootUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // States cho Edit Lab (ClassLab)
  const [editClassLab, setEditClassLab] = useState<ClassLab | null>(null);
  const [editDeadline, setEditDeadline] = useState("");
  const [editDriveRootUrl, setEditDriveRootUrl] = useState("");
  const [editDeadlineOpen, setEditDeadlineOpen] = useState(false);
  const [editPopoverOpen, setEditPopoverOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  // States cho Delete ClassLab
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteClassLabId, setDeleteClassLabId] = useState<string | null>(null);
  const [deleteLabCode, setDeleteLabCode] = useState("");
  const [deleting, setDeleting] = useState(false);

  // States cho Student Roster
  const [studentQuery, setStudentQuery] = useState("");
  const [studentCurrentPage, setStudentCurrentPage] = useState(1);
  const [studentPageSize, setStudentPageSize] = useState(10);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [addStudentForm, setAddStudentForm] = useState({ studentCode: "", email: "", name: "" });
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const [isImportingStudents, setIsImportingStudents] = useState(false);
  const [workbookSheets, setWorkbookSheets] = useState<Record<string, SheetGrid>>({});
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(emptyMapping);

  const handleOpenEditDeadline = useCallback((cl: ClassLab, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditClassLab(cl);
    setEditDeadline(cl.deadline || "");
    setEditDriveRootUrl(cl.drive_root_url || "");
    setEditDeadlineOpen(true);
  }, []);

  const handleOpenDeleteClassLab = useCallback((cl: ClassLab, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteClassLabId(cl.id);
    setDeleteLabCode(cl.lab_code);
    setDeleteDialogOpen(true);
  }, []);

  const handleUpdateDeadline = async () => {
    if (!editClassLab) return;
    setUpdating(true);
    try {
      await updateClassLabDeadlineAction(editClassLab.id, editDeadline || null, editDriveRootUrl || null);
      toast.success("Lab submission settings updated.");
      setEditDeadlineOpen(false);
      load();
    } catch (err) {
      console.error("Failed to update deadline:", err);
      toast.error("Unable to update deadline.");
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmDeleteClassLab = async () => {
    if (!deleteClassLabId) return;
    setDeleting(true);
    try {
      await deleteClassLabAction(deleteClassLabId);
      toast.success("Lab unassigned from class.");
      setDeleteDialogOpen(false);
      load();
    } catch (err) {
      console.error("Failed to unassign lab:", err);
      toast.error("Unable to unassign lab.");
    } finally {
      setDeleting(false);
    }
  };

  const resetImportState = () => {
    setWorkbookSheets({});
    setSheetNames([]);
    setSelectedSheet("");
    setHeaderRow(1);
    setHeaders([]);
    setColumnMapping(emptyMapping);
  };

  const refreshHeadersForSheet = useCallback((sheetName: string, nextHeaderRow: number) => {
    const rows = workbookSheets[sheetName] || [];
    const nextHeaders = (rows[Math.max(nextHeaderRow - 1, 0)] || [])
      .map((cell) => String(cell || "").trim())
      .filter(Boolean);

    setHeaders(nextHeaders);
    setColumnMapping(autoDetectMapping(nextHeaders));
  }, [workbookSheets]);

  useEffect(() => {
    if (!selectedSheet) return;
    refreshHeadersForSheet(selectedSheet, headerRow);
  }, [selectedSheet, headerRow, refreshHeadersForSheet]);

  const handleExcelFileChange = async (file: File | null) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("Please choose an .xlsx or .xls file.");
      return;
    }
    setIsParsingExcel(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const nextSheets: Record<string, SheetGrid> = {};

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
          header: 1,
          defval: "",
          blankrows: false,
        });
        nextSheets[sheetName] = rows.map((row) => row.map((cell) => String(cell ?? "")));
      });

      if (workbook.SheetNames.length === 0) {
        throw new Error("No sheets found in this workbook.");
      }

      setWorkbookSheets(nextSheets);
      setSheetNames(workbook.SheetNames);
      setSelectedSheet(workbook.SheetNames[0]);
      setHeaderRow(1);
      toast.success(`Loaded ${workbook.SheetNames.length} sheet${workbook.SheetNames.length > 1 ? "s" : ""}.`);
    } catch (err: unknown) {
      resetImportState();
      toast.error(getErrorMessage(err, "Unable to read Excel file."));
    } finally {
      setIsParsingExcel(false);
    }
  };

  const handleExcelDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingExcel(false);
    if (isParsingExcel || isImportingStudents) return;
    handleExcelFileChange(event.dataTransfer.files?.[0] || null);
  };

  const handleSaveStudent = async () => {
    setIsSavingStudent(true);
    try {
      const result = await importClassStudentsAction(params.classId, [addStudentForm]);
      toast.success(`Added ${result.imported} student${result.imported === 1 ? "" : "s"}.`);
      setIsAddStudentOpen(false);
      setAddStudentForm({ studentCode: "", email: "", name: "" });
      await load();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to add student."));
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleImportStudents = async (validRows: ImportPreviewRow[]) => {
    setIsImportingStudents(true);
    try {
      const result = await importClassStudentsAction(
        params.classId,
        validRows.map((row) => ({
          studentCode: row.studentCode,
          email: row.email,
          name: row.name,
        }))
      );
      toast.success(`Imported ${result.imported} student${result.imported === 1 ? "" : "s"}${result.skipped ? `, skipped ${result.skipped}` : ""}.`);
      setIsImportOpen(false);
      resetImportState();
      await load();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to import students."));
    } finally {
      setIsImportingStudents(false);
    }
  };

  const selectedDate = deadline ? new Date(deadline) : undefined;

  const formattedDeadline = deadline
    ? (() => {
        try {
          const d = new Date(deadline);
          return d.toLocaleDateString("vi-VN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
        } catch {
          return deadline;
        }
      })()
    : "Pick a date";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [labs, roster, allLabs, classesData, termsData] = await Promise.all([
        getClassLabsForClassAction(params.classId),
        getClassStudentsForClassAction(params.classId),
        getLabCatalogAction(),
        getClassesForTermAction(params.termId),
        getTermsAction(),
      ]);
      setClassLabs(labs);
      setStudents(roster);
      setCatalog(allLabs);

      const currentTerm = termsData.find((t) => t.id === params.termId);
      setTermName(currentTerm ? currentTerm.name : "Term");

      const currentClass = classesData.find((c) => c.id === params.classId);
      setClassName(currentClass ? currentClass.name : "Class");
      setStudentCurrentPage(1);
    } catch (err) {
      console.error("Failed to load class labs:", err);
      toast.error("Unable to load labs.");
    } finally {
      setLoading(false);
    }
  }, [params.classId, params.termId, setStudentCurrentPage]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAssign = async () => {
    setSaving(true);
    try {
      let labId = existingLabId;
      if (!labId) {
        if (!newLabCode.trim()) {
          toast.error("Pick an existing lab or enter a new lab code.");
          setSaving(false);
          return;
        }
        const created = await createLabAction(newLabCode, newLabTitle || null);
        labId = created.id;
      }
      await assignLabToClassAction(params.classId, labId, deadline || null, driveRootUrl || null);
      toast.success("Lab assigned to class.");
      setDialogOpen(false);
      setExistingLabId("");
      setNewLabCode("");
      setNewLabTitle("");
      setDeadline("");
      setDriveRootUrl("");
      load();
    } catch (err) {
      console.error("Failed to assign lab:", err);
      toast.error("Unable to assign lab.");
    } finally {
      setSaving(false);
    }
  };

  const total = classLabs.length;
  const filteredStudents = students.filter((student) => {
    const query = studentQuery.toLowerCase();
    return (
      student.student_code.toLowerCase().includes(query) ||
      (student.student_name || "").toLowerCase().includes(query) ||
      student.student_email.toLowerCase().includes(query)
    );
  });
  const studentTotal = filteredStudents.length;
  const studentTotalPages = Math.ceil(studentTotal / studentPageSize) || 1;
  const studentStartIndex = (studentCurrentPage - 1) * studentPageSize;
  const paginatedStudents = filteredStudents.slice(
    studentStartIndex,
    studentStartIndex + studentPageSize
  );
  const selectedSheetRows = selectedSheet ? workbookSheets[selectedSheet] || [] : [];
  const importPreview = buildImportPreview(selectedSheetRows, headers, headerRow, columnMapping);
  const validImportRows = importPreview.filter((row) => row.errors.length === 0);
  const invalidImportRows = importPreview.length - validImportRows.length;
  const canAddStudent =
    addStudentForm.studentCode.trim() &&
    addStudentForm.email.trim() &&
    addStudentForm.name.trim() &&
    !isSavingStudent;
  const canImportStudents =
    validImportRows.length > 0 &&
    columnMapping.studentCode &&
    columnMapping.email &&
    columnMapping.name &&
    !isImportingStudents;

  return (
    <div className="min-w-0 space-y-6 p-4 sm:p-6 lg:px-8 lg:py-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-muted-foreground shadow-none hover:text-foreground"
          asChild
        >
          <Link href={`/admin/terms/${params.termId}/classes`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Link href="/admin/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <Link
            href={`/admin/terms/${params.termId}/classes`}
            className="transition-colors hover:text-foreground"
          >
            {termName || "Loading..."}
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-semibold text-foreground">{className || "Loading..."}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-semibold text-foreground">Labs</span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">Labs</h2>
            <p className="text-xs text-muted-foreground">
              Open a lab to review scores and submissions. {total} assigned.
            </p>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="shadow-none">
            <Plus className="mr-2 h-4 w-4" />
            Add lab
          </Button>
        </div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-5 bg-card border border-border rounded-lg space-y-3 flex flex-col justify-between h-28"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 rounded" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <Skeleton className="h-3 w-1/2 pl-9" />
                </div>
                <div className="pt-2 border-t border-border/40 pl-9">
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : classLabs.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground border border-dashed shadow-none rounded-xl">
            <Code2 className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
            <p className="font-medium text-foreground mb-1">No labs assigned yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Assign an existing lab or create a new one for this class.
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)} variant="outline">
              Add lab
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {classLabs.map((cl) => {
                const labStudentsHref = `/admin/terms/${params.termId}/classes/${params.classId}/labs/${cl.id}/students`;

                return (
                  <Card key={cl.id} className="relative group h-full space-y-3 p-5 bg-card border border-border shadow-none hover:border-primary/50 transition-all rounded-lg flex flex-col justify-between">
                    <Link
                      href={labStudentsHref}
                      className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      aria-label={`Open ${cl.lab_code} submissions`}
                    />
                    {/* Hover Actions */}
                    <div className="absolute right-4 top-4 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/5 shadow-none p-0"
                        onClick={(e) => handleOpenEditDeadline(cl, e)}
                        title="Edit deadline"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit deadline</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 shadow-none p-0"
                        onClick={(e) => handleOpenDeleteClassLab(cl, e)}
                        title="Unassign lab"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Unassign lab</span>
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-primary">
                          <Code2 className="h-4 w-4" />
                        </div>
                        <div className="pr-16">
                          <p className="text-sm font-bold text-foreground tracking-tight truncate">
                            {cl.lab_code}
                          </p>
                        </div>
                      </div>
                      {cl.lab_title && (
                        <p className="text-xs text-muted-foreground line-clamp-1 pl-9 pr-16">
                          {cl.lab_title}
                        </p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-border/40 pl-9">
                      <div className="flex flex-wrap items-center gap-2">
                        {getDeadlineBadge(cl.deadline)}
                        {cl.drive_root_url ? (
                          <a
                            href={cl.drive_root_url}
                            target="_blank"
                            rel="noreferrer"
                            className="relative z-10 inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-600 px-2.5 text-xs font-bold text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                            aria-label={`Open Drive folder for ${cl.lab_code}`}
                            title={`Open Drive folder for ${cl.lab_code}`}
                          >
                            <FolderOpen className="h-3 w-3" />
                            Open Drive
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <FolderOpen className="h-3 w-3" />
                            No Drive
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>
        )}
      </div>

      <section className="space-y-4 border-t border-border pt-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Students in {className || "Class"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Manage the class roster once, then use each lab card above to inspect results.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">Total {students.length}</Badge>
              <Badge variant="outline" className="font-mono">Showing {studentTotal}</Badge>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={studentQuery}
                onChange={(e) => {
                  setStudentQuery(e.target.value);
                  setStudentCurrentPage(1);
                }}
                placeholder="Search student code, name or email..."
                className="pl-9 shadow-none border-border focus-visible:ring-primary"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => setIsImportOpen(true)} className="h-10 shadow-none">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button size="sm" onClick={() => setIsAddStudentOpen(true)} className="h-10 shadow-none">
              <Users className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
              ))}
            </div>
          </div>
        ) : filteredStudents.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground border border-dashed shadow-none rounded-xl">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
            <p className="font-medium text-foreground mb-1">No students found</p>
            <p className="text-xs text-muted-foreground mb-4">
              {students.length === 0
                ? "Import an Excel file or add students one by one to build this class roster."
                : "No student matches the current search."}
            </p>
            {students.length === 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setIsImportOpen(true)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Import Excel
                </Button>
                <Button size="sm" onClick={() => setIsAddStudentOpen(true)}>
                  <Users className="mr-2 h-4 w-4" />
                  Add Student
                </Button>
              </div>
            ) : null}
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="border border-border shadow-none rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className="font-semibold text-xs text-muted-foreground tracking-wider">
                        Student Code
                      </TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground tracking-wider">
                        Full Name
                      </TableHead>
                      <TableHead className="font-semibold text-xs text-muted-foreground tracking-wider">
                        Email
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStudents.map((student) => (
                      <TableRow key={student.class_student_id} className="hover:bg-muted/10 border-b border-border/60 transition-colors">
                        <TableCell className="font-semibold font-mono text-sm tracking-tight text-foreground">
                          {student.student_code}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {student.student_name || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {student.student_email}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <TablePagination
              pagination={{
                page: studentCurrentPage,
                pageSize: studentPageSize,
                total: studentTotal,
                totalPages: studentTotalPages,
              }}
              loading={loading}
              onPageChange={setStudentCurrentPage}
              onPageSizeChange={(size) => {
                setStudentPageSize(size);
                setStudentCurrentPage(1);
              }}
            />
          </div>
        )}
      </section>

      {/* Add Student Dialog */}
      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Add Student to {className || "Class"}</DialogTitle>
            <DialogDescription className="text-sm">
              Add one student to the current class roster.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground block">Student Code</label>
              <Input
                value={addStudentForm.studentCode}
                onChange={(e) => setAddStudentForm((prev) => ({ ...prev, studentCode: e.target.value }))}
                placeholder="SE182672"
                className="focus-visible:ring-primary shadow-none border-border font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground block">Email</label>
              <Input
                type="email"
                value={addStudentForm.email}
                onChange={(e) => setAddStudentForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="student@fpt.edu.vn"
                className="focus-visible:ring-primary shadow-none border-border"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground block">Full Name</label>
              <Input
                value={addStudentForm.name}
                onChange={(e) => setAddStudentForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nguyen Van A"
                className="focus-visible:ring-primary shadow-none border-border"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-4">
            <Button variant="outline" className="shadow-none" onClick={() => setIsAddStudentOpen(false)} disabled={isSavingStudent}>
              Cancel
            </Button>
            <Button onClick={handleSaveStudent} disabled={!canAddStudent} className="shadow-none">
              {isSavingStudent ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
              Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Students Dialog */}
      <Dialog
        open={isImportOpen}
        onOpenChange={(open) => {
          setIsImportOpen(open);
          if (!open) resetImportState();
        }}
      >
        <DialogContent className="flex h-[calc(100dvh-2rem)] max-h-[760px] max-w-5xl flex-col overflow-hidden bg-card border border-border p-0">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle className="text-lg font-bold">Import Students from Excel</DialogTitle>
            <DialogDescription className="text-sm">
              Select a sheet, map the Excel columns, then import valid rows into {className || "this class"}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-3">
            <div
              className={cn(
                "shrink-0 rounded-lg border border-dashed transition-colors",
                isDraggingExcel
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/20",
                sheetNames.length > 0 ? "p-2.5" : "p-6"
              )}
            >
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3",
                  sheetNames.length === 0 && "min-h-40 justify-center text-center"
                )}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (!isParsingExcel && !isImportingStudents) setIsDraggingExcel(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!isParsingExcel && !isImportingStudents) setIsDraggingExcel(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDraggingExcel(false);
                }}
                onDrop={handleExcelDrop}
              >
                <span className={cn(
                  "flex shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary",
                  sheetNames.length > 0 ? "h-9 w-9" : "h-14 w-14"
                )}>
                  <Upload className={sheetNames.length > 0 ? "h-4 w-4" : "h-7 w-7"} />
                </span>
                <span className={cn("min-w-0", sheetNames.length > 0 ? "flex-1" : "")}>
                  <span className="block text-sm font-semibold text-foreground">
                    {isParsingExcel
                      ? "Reading workbook..."
                      : isDraggingExcel
                        ? "Drop the Excel file here"
                        : "Drag Excel here or choose a file"}
                  </span>
                  <span className={cn(
                    "block text-xs text-muted-foreground",
                    sheetNames.length > 0 ? "truncate" : "mt-1"
                  )}>
                    Supports .xlsx and .xls. Required columns can be mapped manually after upload.
                  </span>
                </span>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={isParsingExcel || isImportingStudents}
                  onChange={(e) => handleExcelFileChange(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {sheetNames.length > 0 ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground block">Sheet</label>
                    <Select
                      value={selectedSheet}
                      onValueChange={setSelectedSheet}
                    >
                      <SelectTrigger className="w-full rounded-md shadow-none border-border focus:ring-primary">
                        <SelectValue placeholder="Select sheet" />
                      </SelectTrigger>
                      <SelectContent>
                        {sheetNames.map((sheetName) => (
                          <SelectItem key={sheetName} value={sheetName}>
                            {sheetName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground block">Header Row</label>
                    <Input
                      type="number"
                      min={1}
                      max={Math.max(selectedSheetRows.length, 1)}
                      value={headerRow}
                      onChange={(e) => setHeaderRow(Math.max(parseInt(e.target.value, 10) || 1, 1))}
                      className="focus-visible:ring-primary shadow-none border-border"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ["studentCode", "Student Code"],
                    ["email", "Email"],
                    ["name", "Full Name"],
                  ].map(([key, label]) => (
                    <div key={key} className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground block">{label}</label>
                      <Select
                        value={columnMapping[key as keyof ColumnMapping] || NO_COLUMN_VALUE}
                        onValueChange={(value) =>
                          setColumnMapping((prev) => ({
                            ...prev,
                            [key]: value === NO_COLUMN_VALUE ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full rounded-md shadow-none border-border focus:ring-primary">
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_COLUMN_VALUE}>Select column</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono">Rows: {importPreview.length}</Badge>
                  <Badge className="border-none bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 font-mono">
                    Valid: {validImportRows.length}
                  </Badge>
                  <Badge className="border-none bg-red-500/10 text-red-600 hover:bg-red-500/10 font-mono">
                    Invalid: {invalidImportRows}
                  </Badge>
                </div>

                <div className="min-h-[140px] flex-1 overflow-hidden rounded-lg border border-border">
                  <div className="h-full overflow-auto pb-3">
                    <Table className="min-w-[760px]">
                      <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[80px]">Row</TableHead>
                          <TableHead>Student Code</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Full Name</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                              No preview rows. Check the selected sheet, header row and column mapping.
                            </TableCell>
                          </TableRow>
                        ) : (
                          importPreview.map((row) => (
                            <TableRow key={row.rowNumber}>
                              <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                              <TableCell className="font-mono text-sm font-semibold">{row.studentCode || "—"}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{row.email || "—"}</TableCell>
                              <TableCell className="text-sm">{row.name || "—"}</TableCell>
                              <TableCell>
                                {row.errors.length === 0 ? (
                                  <Badge className="border-none bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">Valid</Badge>
                                ) : (
                                  <Badge className="border-none bg-red-500/10 text-red-600 hover:bg-red-500/10">
                                    {row.errors.join(", ")}
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="relative z-10 shrink-0 gap-2 border-t border-border bg-card px-6 py-3 sm:gap-0">
            <Button variant="outline" className="shadow-none" onClick={() => setIsImportOpen(false)} disabled={isImportingStudents}>
              Cancel
            </Button>
            <Button onClick={() => handleImportStudents(validImportRows)} disabled={!canImportStudents} className="shadow-none">
              {isImportingStudents ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Import Students
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px] border border-border shadow-none rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Assign lab to class</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Select Lab</label>
              <Select
                value={existingLabId || "none"}
                onValueChange={(val) => setExistingLabId(val === "none" ? "" : val)}
              >
                <SelectTrigger className="w-full shadow-none border-border focus:ring-primary">
                  <SelectValue placeholder="— Create new lab instead —" />
                </SelectTrigger>
                <SelectContent className="w-full">
                  <SelectItem value="none">— Create new lab instead —</SelectItem>
                  {catalog.map((lab) => (
                    <SelectItem key={lab.id} value={lab.id}>
                      {lab.code} {lab.title ? `— ${lab.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!existingLabId && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    New Lab Code
                  </label>
                  <Input
                    placeholder="e.g. LAB1, PRN_A1"
                    value={newLabCode}
                    onChange={(e) => setNewLabCode(e.target.value)}
                    className="shadow-none border-border focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Lab Title (optional)
                  </label>
                  <Input
                    placeholder="e.g. C# Fundamentals"
                    value={newLabTitle}
                    onChange={(e) => setNewLabTitle(e.target.value)}
                    className="shadow-none border-border focus-visible:ring-primary"
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Deadline (optional)
              </label>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <div className="relative">
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal pr-10 shadow-none border-border focus:ring-primary",
                        !deadline && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                      <span className="truncate">{formattedDeadline}</span>
                    </Button>
                  </PopoverTrigger>
                  {deadline && (
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeadline("");
                        setPopoverOpen(false);
                      }}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Clear</span>
                    </button>
                  )}
                </div>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => {
                      if (!d) {
                        setDeadline("");
                      } else {
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, "0");
                        const day = String(d.getDate()).padStart(2, "0");
                        setDeadline(`${year}-${month}-${day}T23:59:00`);
                        setPopoverOpen(false);
                      }
                    }}
                    defaultMonth={selectedDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Drive root link
              </label>
              <Input
                placeholder="https://drive.google.com/drive/folders/..."
                value={driveRootUrl}
                onChange={(e) => setDriveRootUrl(e.target.value)}
                className="shadow-none border-border focus-visible:ring-primary"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Students will see this folder while the lab is open. After the deadline, requests must include their own Drive link.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="shadow-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              size="sm"
              disabled={saving}
              className="bg-primary hover:bg-primary-hover text-white shadow-none"
            >
              {saving ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Deadline Dialog */}
      <Dialog open={editDeadlineOpen} onOpenChange={setEditDeadlineOpen}>
        <DialogContent className="sm:max-w-[400px] border border-border shadow-none rounded-xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Edit deadline: {editClassLab?.lab_code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground block">
                Deadline (optional)
              </label>
              <Popover open={editPopoverOpen} onOpenChange={setEditPopoverOpen}>
                <div className="relative">
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal pr-10 shadow-none border-border focus:ring-primary",
                        !editDeadline && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                      <span className="truncate">
                        {editDeadline
                          ? (() => {
                              try {
                                const d = new Date(editDeadline);
                                return d.toLocaleDateString("vi-VN", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                });
                              } catch {
                                return editDeadline;
                              }
                            })()
                          : "Pick a date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  {editDeadline && (
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditDeadline("");
                        setEditPopoverOpen(false);
                      }}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Clear</span>
                    </button>
                  )}
                </div>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editDeadline ? new Date(editDeadline) : undefined}
                    onSelect={(d) => {
                      if (!d) {
                        setEditDeadline("");
                      } else {
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, "0");
                        const day = String(d.getDate()).padStart(2, "0");
                        setEditDeadline(`${year}-${month}-${day}T23:59:00`);
                        setEditPopoverOpen(false);
                      }
                    }}
                    defaultMonth={editDeadline ? new Date(editDeadline) : undefined}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground block">
                Drive root link
              </label>
              <Input
                placeholder="https://drive.google.com/drive/folders/..."
                value={editDriveRootUrl}
                onChange={(e) => setEditDriveRootUrl(e.target.value)}
                className="shadow-none border-border focus-visible:ring-primary"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDeadlineOpen(false)}
              disabled={updating}
              className="shadow-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateDeadline}
              size="sm"
              disabled={updating}
              className="bg-primary hover:bg-primary-hover text-white shadow-none"
            >
              {updating ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete ClassLab Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This action will unassign the lab <span className="font-semibold text-foreground">{deleteLabCode}</span> from class <span className="font-semibold text-foreground">{className}</span>.
              <br />
              <br />
              <span className="text-red-500 font-semibold">Warning:</span> All student submissions and grading results associated with this lab in this class will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel disabled={deleting} className="shadow-none border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDeleteClassLab();
              }}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700 shadow-none"
            >
              {deleting ? "Deleting..." : "Delete Lab Assignment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


