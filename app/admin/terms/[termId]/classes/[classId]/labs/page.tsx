"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Calendar as CalendarIcon, Code2, Plus, X, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
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
} from "@/lib/actions/erd-admin";
import type { ClassLab, Lab } from "@/lib/types/erd";

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

export default function AdminClassLabsPage() {
  const params = useParams<{ termId: string; classId: string }>();
  const router = useRouter();
  const [classLabs, setClassLabs] = useState<ClassLab[]>([]);
  const [catalog, setCatalog] = useState<Lab[]>([]);
  const [termName, setTermName] = useState("");
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [existingLabId, setExistingLabId] = useState("");
  const [newLabCode, setNewLabCode] = useState("");
  const [newLabTitle, setNewLabTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // States cho Edit Lab (ClassLab)
  const [editClassLab, setEditClassLab] = useState<ClassLab | null>(null);
  const [editDeadline, setEditDeadline] = useState("");
  const [editDeadlineOpen, setEditDeadlineOpen] = useState(false);
  const [editPopoverOpen, setEditPopoverOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  // States cho Delete ClassLab
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteClassLabId, setDeleteClassLabId] = useState<string | null>(null);
  const [deleteLabCode, setDeleteLabCode] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleOpenEditDeadline = useCallback((cl: ClassLab, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditClassLab(cl);
    setEditDeadline(cl.deadline || "");
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
      await updateClassLabDeadlineAction(editClassLab.id, editDeadline || null);
      toast.success("Deadline updated.");
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

  // Phân trang client-side
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [labs, allLabs, classesData, termsData] = await Promise.all([
        getClassLabsForClassAction(params.classId),
        getLabCatalogAction(),
        getClassesForTermAction(params.termId),
        getTermsAction(),
      ]);
      setClassLabs(labs);
      setCatalog(allLabs);

      const currentTerm = termsData.find((t) => t.id === params.termId);
      setTermName(currentTerm ? currentTerm.name : "Term");

      const currentClass = classesData.find((c) => c.id === params.classId);
      setClassName(currentClass ? currentClass.name : "Class");
      setCurrentPage(1);
    } catch (err) {
      console.error("Failed to load class labs:", err);
      toast.error("Unable to load labs.");
    } finally {
      setLoading(false);
    }
  }, [params.classId, params.termId]);

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
      await assignLabToClassAction(params.classId, labId, deadline || null);
      toast.success("Lab assigned to class.");
      setDialogOpen(false);
      setExistingLabId("");
      setNewLabCode("");
      setNewLabTitle("");
      setDeadline("");
      load();
    } catch (err) {
      console.error("Failed to assign lab:", err);
      toast.error("Unable to assign lab.");
    } finally {
      setSaving(false);
    }
  };

  // Tính toán dữ liệu phân trang
  const total = classLabs.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedClassLabs = classLabs.slice(startIndex, startIndex + pageSize);

  return (
    <div className="min-w-0 space-y-6 p-4 sm:p-6 lg:px-8 lg:py-6">
      {/* Breadcrumbs và Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground shadow-none"
              asChild
            >
              <Link href={`/admin/terms/${params.termId}/classes`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Link href="/admin/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <span className="text-muted-foreground/40">/</span>
              <Link
                href={`/admin/terms/${params.termId}/classes`}
                className="hover:text-foreground transition-colors"
              >
                {termName || "Loading..."}
              </Link>
              <span className="text-muted-foreground/40">/</span>
              <span className="font-semibold text-foreground">{className || "Loading..."}</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="font-semibold text-foreground">Labs</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight pl-11">
            Labs for {className || "Loading..."}
          </h1>
          <p className="text-xs text-muted-foreground pl-11">
            Manage auto-graded assignments, test configurations and deadlines.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="bg-primary hover:bg-primary-hover text-white shadow-none border-none self-start sm:self-center"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Assign lab
        </Button>
      </div>

      <div className="space-y-6">
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
              Assign Lab
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedClassLabs.map((cl) => (
                <Link
                  key={cl.id}
                  href={`/admin/terms/${params.termId}/classes/${params.classId}/labs/${cl.id}/students`}
                >
                  <Card className="relative group h-full space-y-3 p-5 bg-card border border-border shadow-none hover:border-primary/50 transition-all rounded-lg flex flex-col justify-between">
                    {/* Hover Actions */}
                    <div className="absolute right-4 top-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      {getDeadlineBadge(cl.deadline)}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>

            <TablePagination
              pagination={{
                page: currentPage,
                pageSize: pageSize,
                total: total,
                totalPages: totalPages,
              }}
              loading={loading}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

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
          <div className="space-y-1.5 py-4">
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


