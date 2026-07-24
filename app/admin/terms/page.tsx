"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GraduationCap, Plus, Pencil, Trash2 } from "lucide-react";

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
import { createTermAction, updateTermAction, deleteTermAction } from "@/lib/actions/erd-admin";
import type { Term } from "@/lib/types/erd";
import { adminTermsQueryOptions } from "@/lib/queries/admin";
import { invalidateAdminRootCaches } from "@/lib/queries/invalidation";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function AdminTermsPage() {
  const queryClient = useQueryClient();
  const { data: terms = [], error, isPending: loading } = useQuery(adminTermsQueryOptions());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [saving, setSaving] = useState(false);

  // Phân trang client-side
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // States cho Edit Term
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTerm, setEditTerm] = useState<Term | null>(null);
  const [editName, setEditName] = useState("");
  const [editStartsOn, setEditStartsOn] = useState("");
  const [editEndsOn, setEditEndsOn] = useState("");
  const [updating, setUpdating] = useState(false);

  // States cho Delete Term
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTermId, setDeleteTermId] = useState<string | null>(null);
  const [deleteTermName, setDeleteTermName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleOpenEdit = useCallback((term: Term, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditTerm(term);
    setEditName(term.name);
    setEditStartsOn(term.starts_on || "");
    setEditEndsOn(term.ends_on || "");
    setEditDialogOpen(true);
  }, []);

  const handleOpenDelete = useCallback((term: Term, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTermId(term.id);
    setDeleteTermName(term.name);
    setDeleteDialogOpen(true);
  }, []);

  const handleUpdate = async () => {
    if (!editTerm) return;
    if (!editName.trim()) {
      toast.error("Term name is required.");
      return;
    }
    setUpdating(true);
    try {
      await updateTermAction(editTerm.id, editName, editStartsOn || null, editEndsOn || null);
      toast.success("Term updated.");
      setEditDialogOpen(false);
      await invalidateAdminRootCaches(queryClient);
    } catch (err) {
      console.error("Failed to update term:", err);
      toast.error("Unable to update term.");
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTermId) return;
    setDeleting(true);
    try {
      await deleteTermAction(deleteTermId);
      toast.success("Term and all associated classes deleted.");
      setDeleteDialogOpen(false);
      await invalidateAdminRootCaches(queryClient);
    } catch (err) {
      console.error("Failed to delete term:", err);
      toast.error("Unable to delete term.");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!error) return;
    console.error("Failed to load terms:", error);
    toast.error("Unable to load terms.");
  }, [error]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Term name is required.");
      return;
    }
    setSaving(true);
    try {
      await createTermAction(name, startsOn || null, endsOn || null);
      toast.success("Term created.");
      setDialogOpen(false);
      setName("");
      setStartsOn("");
      setEndsOn("");
      await invalidateAdminRootCaches(queryClient);
    } catch (err) {
      console.error("Failed to create term:", err);
      toast.error("Unable to create term.");
    } finally {
      setSaving(false);
    }
  };

  // Tính toán dữ liệu phân trang
  const total = terms.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTerms = terms.slice(startIndex, startIndex + pageSize);

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-6 p-4 sm:p-6 lg:px-8 lg:pb-4 lg:pt-6">
      {/* Breadcrumbs và Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Terms</h1>
          <p className="text-xs text-muted-foreground">
            Manage academic semesters, dates and class schedules.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="bg-primary hover:bg-primary-hover text-white shadow-none border-none self-start sm:self-center"
        >
          <Plus className="mr-1.5 h-4 w-4" /> New term
        </Button>
      </div>

      <div className="flex flex-1 flex-col">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 border border-border bg-card p-5 rounded-lg space-y-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-2 w-1/4" />
                  </div>
                </div>
                <div className="pt-2 border-t border-border/40">
                  <Skeleton className="h-3.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : terms.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground border border-dashed shadow-none rounded-xl">
            <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
            <p className="font-medium text-foreground mb-1">No terms yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Get started by creating your first academic term.
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)} variant="outline">
              Create Term
            </Button>
          </Card>
        ) : (
          <div className="flex flex-1 flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedTerms.map((term) => (
                <Link key={term.id} href={`/admin/terms/${term.id}/classes`}>
                  <Card className="relative group h-full space-y-2.5 p-5 bg-card border border-border shadow-none hover:border-primary/50 transition-all rounded-lg">
                    {/* Hover Actions */}
                    <div className="absolute right-4 top-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/5 shadow-none p-0"
                        onClick={(e) => handleOpenEdit(term, e)}
                        title="Edit term"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit term</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 shadow-none p-0"
                        onClick={(e) => handleOpenDelete(term, e)}
                        title="Delete term"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete term</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
                        <GraduationCap className="h-4.5 w-4.5" />
                      </div>
                      <div className="pr-16">
                        <p className="text-sm font-bold text-foreground tracking-tight truncate">
                          {term.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground tracking-wider uppercase font-semibold">
                          Semester
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground/80 flex items-center gap-1.5 pt-2 border-t border-border/40">
                      <span>{formatDate(term.starts_on)}</span>
                      <span className="text-muted-foreground/40">→</span>
                      <span>{formatDate(term.ends_on)}</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>

            <TablePagination
              fullBleed
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
            <DialogTitle className="text-base font-bold">Create new term</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Term Name</label>
              <Input
                placeholder="e.g. SP26, FA25"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="shadow-none border-border focus-visible:ring-primary focus-visible:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Starts On</label>
                <Input
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                  className="shadow-none border-border focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Ends On</label>
                <Input
                  type="date"
                  value={endsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                  className="shadow-none border-border focus-visible:ring-primary"
                />
              </div>
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
              onClick={handleCreate}
              size="sm"
              disabled={saving}
              className="bg-primary hover:bg-primary-hover text-white shadow-none"
            >
              {saving ? "Creating..." : "Create term"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Term Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px] border border-border shadow-none rounded-xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Edit term</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Term Name</label>
              <Input
                placeholder="e.g. SP26, FA25"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="shadow-none border-border focus-visible:ring-primary focus-visible:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Starts On</label>
                <Input
                  type="date"
                  value={editStartsOn}
                  onChange={(e) => setEditStartsOn(e.target.value)}
                  className="shadow-none border-border focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Ends On</label>
                <Input
                  type="date"
                  value={editEndsOn}
                  onChange={(e) => setEditEndsOn(e.target.value)}
                  className="shadow-none border-border focus-visible:ring-primary"
                />
              </div>
            </div>
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
              onClick={handleUpdate}
              size="sm"
              disabled={updating}
              className="bg-primary hover:bg-primary-hover text-white shadow-none"
            >
              {updating ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Term Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This action will permanently delete the term{" "}
              <span className="font-semibold text-foreground">{deleteTermName}</span>.
              <br />
              <br />
              <span className="text-red-500 font-semibold">Warning:</span> All classes, enrolled
              students, lab assignments, submissions and grades in this term will also be
              permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel disabled={deleting} className="shadow-none border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700 shadow-none"
            >
              {deleting ? "Deleting..." : "Delete Term"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
