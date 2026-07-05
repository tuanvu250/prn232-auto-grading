"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Users, Pencil, Trash2 } from "lucide-react";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/admin/TablePagination";
import {
  getClassesForTermAction,
  createClassAction,
  getTermsAction,
  updateClassAction,
  deleteClassAction,
} from "@/lib/actions/erd-admin";
import type { ClassRow } from "@/lib/types/erd";

export default function AdminClassesPage() {
  const params = useParams<{ termId: string }>();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [termName, setTermName] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // States cho Edit Class
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editClass, setEditClass] = useState<ClassRow | null>(null);
  const [editName, setEditName] = useState("");
  const [updating, setUpdating] = useState(false);

  // States cho Delete Class
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteClassId, setDeleteClassId] = useState<string | null>(null);
  const [deleteClassName, setDeleteClassName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleOpenEdit = useCallback((cls: ClassRow, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditClass(cls);
    setEditName(cls.name);
    setEditDialogOpen(true);
  }, []);

  const handleOpenDelete = useCallback((cls: ClassRow, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteClassId(cls.id);
    setDeleteClassName(cls.name);
    setDeleteDialogOpen(true);
  }, []);

  const handleUpdateClass = async () => {
    if (!editClass) return;
    if (!editName.trim()) {
      toast.error("Class name is required.");
      return;
    }
    setUpdating(true);
    try {
      await updateClassAction(editClass.id, editName);
      toast.success("Class updated.");
      setEditDialogOpen(false);
      load();
    } catch (err) {
      console.error("Failed to update class:", err);
      toast.error("Unable to update class.");
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmDeleteClass = async () => {
    if (!deleteClassId) return;
    setDeleting(true);
    try {
      await deleteClassAction(deleteClassId);
      toast.success("Class and all associated results deleted.");
      setDeleteDialogOpen(false);
      load();
    } catch (err) {
      console.error("Failed to delete class:", err);
      toast.error("Unable to delete class.");
    } finally {
      setDeleting(false);
    }
  };

  // Phân trang client-side
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [classesData, termsData] = await Promise.all([
        getClassesForTermAction(params.termId),
        getTermsAction(),
      ]);
      setClasses(classesData);
      const currentTerm = termsData.find((t) => t.id === params.termId);
      setTermName(currentTerm ? currentTerm.name : "Term");
      setCurrentPage(1);
    } catch (err) {
      console.error("Failed to load classes:", err);
      toast.error("Unable to load classes.");
    } finally {
      setLoading(false);
    }
  }, [params.termId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Class name is required.");
      return;
    }
    setSaving(true);
    try {
      await createClassAction(params.termId, name);
      toast.success("Class created.");
      setDialogOpen(false);
      setName("");
      load();
    } catch (err) {
      console.error("Failed to create class:", err);
      toast.error("Unable to create class.");
    } finally {
      setSaving(false);
    }
  };

  // Tính toán dữ liệu phân trang
  const total = classes.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedClasses = classes.slice(startIndex, startIndex + pageSize);

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
              <Link href="/admin/terms">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Link href="/admin/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <span className="text-muted-foreground/40">/</span>
              <span className="font-semibold text-foreground">{termName || "Loading..."}</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="font-semibold text-foreground">Classes</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight pl-11">
            Classes for {termName || "Loading..."}
          </h1>
          <p className="text-xs text-muted-foreground pl-11">
            Browse and manage student classes enrolled in this semester.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="bg-primary hover:bg-primary-hover text-white shadow-none border-none self-start sm:self-center"
        >
          <Plus className="mr-1.5 h-4 w-4" /> New class
        </Button>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-5 bg-card border border-border rounded-lg"
              >
                <Skeleton className="h-9 w-9 rounded" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-2.5 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : classes.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground border border-dashed shadow-none rounded-xl">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
            <p className="font-medium text-foreground mb-1">No classes in this term yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Get started by creating your first class for this term.
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)} variant="outline">
              Create Class
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedClasses.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/admin/terms/${params.termId}/classes/${cls.id}/labs`}
                >
                  <Card className="relative group h-full flex items-center gap-3 p-5 bg-card border border-border shadow-none hover:border-primary/50 transition-all rounded-lg">
                    {/* Hover Actions */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/5 shadow-none p-0"
                        onClick={(e) => handleOpenEdit(cls, e)}
                        title="Edit class"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit class</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 shadow-none p-0"
                        onClick={(e) => handleOpenDelete(cls, e)}
                        title="Delete class"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete class</span>
                      </Button>
                    </div>

                    <div className="flex h-9 w-9 items-center justify-center rounded bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="pr-16">
                      <p className="text-sm font-bold text-foreground tracking-tight truncate">{cls.name}</p>
                      <p className="text-[10px] text-muted-foreground tracking-wider uppercase font-semibold">
                        Class Section
                      </p>
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
            <DialogTitle className="text-base font-bold">Create class</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label className="text-xs font-semibold text-muted-foreground">Class Name</label>
            <Input
              placeholder="e.g. SE1801, IA1702"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="shadow-none border-border focus-visible:ring-primary focus-visible:border-primary"
            />
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
              onClick={handleCreate}
              size="sm"
              disabled={saving}
              className="bg-primary hover:bg-primary-hover text-white shadow-none"
            >
              {saving ? "Creating..." : "Create class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px] border border-border shadow-none rounded-xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Edit class</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label className="text-xs font-semibold text-muted-foreground">Class Name</label>
            <Input
              placeholder="e.g. SE1801, IA1702"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="shadow-none border-border focus-visible:ring-primary focus-visible:border-primary"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(false)}
              disabled={updating}
              className="shadow-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateClass}
              size="sm"
              disabled={updating}
              className="bg-primary hover:bg-primary-hover text-white shadow-none"
            >
              {updating ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Class Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This action will permanently delete the class <span className="font-semibold text-foreground">{deleteClassName}</span>.
              <br />
              <br />
              <span className="text-red-500 font-semibold">Warning:</span> All students, lab assignments, submissions and grading results belonging to this class will also be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel disabled={deleting} className="shadow-none border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDeleteClass();
              }}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700 shadow-none"
            >
              {deleting ? "Deleting..." : "Delete Class"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


