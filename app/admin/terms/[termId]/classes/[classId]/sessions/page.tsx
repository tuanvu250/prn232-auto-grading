"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Code2,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StudentRosterSidebar } from "@/components/admin/StudentRosterSidebar";
import { TablePagination } from "@/components/admin/TablePagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createLabAction,
  createGradingSessionsAction,
  deleteGradingSessionAction,
  updateGradingSessionAction,
} from "@/lib/actions/erd-admin";
import { adminClassWorkspaceQueryOptions, adminQueryKeys } from "@/lib/queries/admin";
import type { GradingSession, GradingSessionStatus } from "@/lib/types/erd";
import { compareNaturalText } from "@/lib/utils/grading-session";

function formatDeadline(deadline: string | null) {
  if (!deadline) return "No deadline";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(deadline));
}

function toLocalInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

type SessionDraft = {
  name: string;
  deadline: string;
  driveRootUrl: string;
  status: GradingSessionStatus;
};

const CREATE_LAB_VALUE = "__create_new_lab__";

export default function AdminGradingSessionsPage() {
  const params = useParams<{ termId: string; classId: string }>();
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(
    adminClassWorkspaceQueryOptions(params.termId, params.classId)
  );
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedLabId, setSelectedLabId] = useState("");
  const [creatingLab, setCreatingLab] = useState(false);
  const [newLabCode, setNewLabCode] = useState("");
  const [newLabTitle, setNewLabTitle] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([params.classId]);
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [driveRootUrls, setDriveRootUrls] = useState<Record<string, string>>({
    [params.classId]: "",
  });
  const [editing, setEditing] = useState<GradingSession | null>(null);
  const [editDraft, setEditDraft] = useState<SessionDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GradingSession | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("create") !== "1") return;
    const timer = window.setTimeout(() => setCreateOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: adminQueryKeys.classWorkspace(params.termId, params.classId),
    });

  const createMutation = useMutation({
    mutationFn: () =>
      createGradingSessionsAction({
        termId: params.termId,
        targets: selectedClassIds.map((classId) => ({
          classId,
          driveRootUrl: driveRootUrls[classId] ?? "",
        })),
        labId: selectedLabId,
        name,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      }),
    onSuccess: async (result) => {
      await refresh();
      toast.success(`Created ${result.created} grading session${result.created === 1 ? "" : "s"}.`);
      setCreateOpen(false);
      setSelectedLabId("");
      setCreatingLab(false);
      setNewLabCode("");
      setNewLabTitle("");
      setSelectedClassIds([params.classId]);
      setName("");
      setDeadline("");
      setDriveRootUrls({ [params.classId]: "" });
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const createLabMutation = useMutation({
    mutationFn: () => createLabAction(newLabCode, newLabTitle.trim() || null),
    onSuccess: async (lab) => {
      await refresh();
      setSelectedLabId(lab.id);
      setCreatingLab(false);
      setNewLabCode("");
      setNewLabTitle("");
      toast.success(`${lab.code} was created and selected.`);
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing || !editDraft) throw new Error("Session is not selected");
      return updateGradingSessionAction(editing.id, {
        ...editDraft,
        deadline: editDraft.deadline ? new Date(editDraft.deadline).toISOString() : null,
      });
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Session updated.");
      setEditing(null);
      setEditDraft(null);
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!deleteTarget) throw new Error("Session is not selected");
      return deleteGradingSessionAction(deleteTarget.id);
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Session deleted.");
      setDeleteTarget(null);
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const sessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visibleSessions = normalized
      ? (data?.sessions ?? []).filter((session) =>
          [session.name, session.lab_code, session.lab_title]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalized))
        )
      : (data?.sessions ?? []);

    return [...visibleSessions].sort(
      (left, right) =>
        compareNaturalText(left.lab_code, right.lab_code) ||
        compareNaturalText(left.name, right.name) ||
        left.created_at.localeCompare(right.created_at)
    );
  }, [data?.sessions, query]);

  const totalPages = Math.ceil(sessions.length / pageSize) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedSessions = sessions.slice(startIndex, startIndex + pageSize);

  const openEditor = (session: GradingSession) => {
    setEditing(session);
    setEditDraft({
      name: session.name,
      deadline: toLocalInputValue(session.deadline),
      driveRootUrl: session.drive_root_url ?? "",
      status: session.status,
    });
  };

  const toggleClass = (classId: string, checked: boolean) => {
    setSelectedClassIds((current) =>
      checked ? Array.from(new Set([...current, classId])) : current.filter((id) => id !== classId)
    );
    if (checked) {
      setDriveRootUrls((current) => ({ ...current, [classId]: current[classId] ?? "" }));
    }
  };

  return (
    <div className="min-h-full lg:h-full lg:overflow-hidden">
      <div className="grid min-h-full min-w-0 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="order-last flex min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 lg:order-first lg:h-full lg:overflow-y-auto lg:px-8 lg:pb-4 lg:pt-6">
          <AdminPageHeader
            breadcrumbs={[
              { label: "Terms", href: "/admin/terms" },
              { label: data?.termName ?? "Term", href: `/admin/terms/${params.termId}/classes` },
              { label: data?.className ?? "Class" },
            ]}
            title="Grading sessions"
            description="Open, close and review independent submission windows for this class."
            backHref={`/admin/terms/${params.termId}/classes`}
            actions={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create session
              </Button>
            }
          />

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search name or lab code"
                className="pl-9"
                aria-label="Search grading sessions"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {sessions.length} session{sessions.length === 1 ? "" : "s"} ·{" "}
              {data?.students.length ?? 0} students
            </p>
          </div>

          {error ? (
            <Card className="border-destructive/40 p-6 text-sm text-destructive">
              Unable to load grading sessions: {error.message}
            </Card>
          ) : isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 border-y border-dashed border-border text-center">
              <CalendarClock className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-semibold">No grading sessions found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create one session for this class or apply it to several classes in the term.
                </p>
              </div>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create the first session
              </Button>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {paginatedSessions.map((session) => (
                  <Card
                    key={session.id}
                    className="group relative flex h-full items-center gap-3 rounded-lg border border-border bg-card p-5 shadow-none transition-all hover:border-primary/50"
                  >
                    <Link
                      href={`/admin/terms/${params.termId}/classes/${params.classId}/sessions/${session.id}/students`}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md pr-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        <Code2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold tracking-tight text-foreground">
                          {session.name}
                        </p>
                        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {session.lab_code} · {session.status} · {formatDeadline(session.deadline)}
                        </p>
                      </div>
                    </Link>

                    <div className="absolute right-4 top-1/2 flex -translate-y-1/2 gap-1 opacity-100 transition-opacity xl:opacity-0 xl:group-focus-within:opacity-100 xl:group-hover:opacity-100">
                      {session.drive_root_url ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 p-0 text-muted-foreground hover:bg-primary/5 hover:text-primary"
                          asChild
                        >
                          <a
                            href={session.drive_root_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Open Drive"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            <span className="sr-only">Open Drive</span>
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0 text-muted-foreground hover:bg-primary/5 hover:text-primary"
                        onClick={() => openEditor(session)}
                        title="Manage session"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                        <span className="sr-only">Manage session</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        onClick={() => setDeleteTarget(session)}
                        aria-label={`Delete ${session.name}`}
                        title="Delete session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              <TablePagination
                fullBleed
                pagination={{
                  page: activePage,
                  pageSize,
                  total: sessions.length,
                  totalPages,
                }}
                loading={isPending}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </main>

        <StudentRosterSidebar
          classId={params.classId}
          className={data?.className ?? "Class"}
          students={data?.students ?? []}
          loading={isPending}
          onRosterImported={refresh}
        />
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create grading sessions</DialogTitle>
            <DialogDescription>
              One configuration creates an independent session for every selected class.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="session-lab">Lab</Label>
                <Select
                  value={selectedLabId}
                  onValueChange={(value) => {
                    if (value === CREATE_LAB_VALUE) {
                      setCreatingLab(true);
                      return;
                    }
                    setSelectedLabId(value);
                    setCreatingLab(false);
                  }}
                >
                  <SelectTrigger id="session-lab">
                    <SelectValue placeholder="Select a lab" />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.catalog ?? []).map((lab) => (
                      <SelectItem key={lab.id} value={lab.id}>
                        {lab.code}
                        {lab.title ? ` · ${lab.title}` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value={CREATE_LAB_VALUE}
                      className="mt-1 border-t border-border pt-2 font-medium text-primary"
                    >
                      <span className="flex items-center gap-2">
                        <Plus className="h-3.5 w-3.5" /> Create new lab
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="session-name">Session name</Label>
                <Input
                  id="session-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Lab 1 - Main session"
                />
              </div>
            </div>
            {creatingLab ? (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="mb-3">
                  <p className="text-sm font-medium">Create a new lab</p>
                  <p className="text-xs text-muted-foreground">
                    The new lab will be selected for this session after it is created.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-lab-code">Lab code</Label>
                    <Input
                      id="new-lab-code"
                      value={newLabCode}
                      onChange={(event) => setNewLabCode(event.target.value)}
                      placeholder="LAB3"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-lab-title">Title</Label>
                    <Input
                      id="new-lab-title"
                      value={newLabTitle}
                      onChange={(event) => setNewLabTitle(event.target.value)}
                      placeholder="Optional lab title"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCreatingLab(false);
                        setNewLabCode("");
                        setNewLabTitle("");
                      }}
                      disabled={createLabMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => createLabMutation.mutate()}
                      disabled={createLabMutation.isPending || !newLabCode.trim()}
                    >
                      {createLabMutation.isPending ? "Creating…" : "Create lab"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="max-w-sm space-y-1.5">
              <div className="space-y-1.5">
                <Label htmlFor="session-deadline">Deadline</Label>
                <DateTimePicker
                  id="session-deadline"
                  min={new Date()}
                  value={deadline}
                  onChange={setDeadline}
                />
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Classes and Drive folders</legend>
              <p className="text-xs text-muted-foreground">
                Each class creates an independent session. Drive root URLs are optional.
              </p>
              <div className="max-h-72 divide-y divide-border overflow-y-auto border-y border-border">
                {(data?.classes ?? []).map((classRow) => {
                  const checked = selectedClassIds.includes(classRow.id);
                  return (
                    <div
                      key={classRow.id}
                      className="grid gap-3 px-1 py-3 sm:grid-cols-[minmax(10rem,0.45fr)_minmax(0,1fr)] sm:items-center"
                    >
                      <label
                        htmlFor={`session-class-${classRow.id}`}
                        className="flex cursor-pointer items-center gap-3 text-sm"
                      >
                        <Checkbox
                          id={`session-class-${classRow.id}`}
                          checked={checked}
                          onCheckedChange={(value) => toggleClass(classRow.id, value === true)}
                        />
                        <span className="font-medium">{classRow.name}</span>
                        {classRow.id === params.classId ? (
                          <span className="text-xs text-muted-foreground">Current</span>
                        ) : null}
                      </label>
                      {checked ? (
                        <Input
                          type="url"
                          value={driveRootUrls[classRow.id] ?? ""}
                          onChange={(event) =>
                            setDriveRootUrls((current) => ({
                              ...current,
                              [classRow.id]: event.target.value,
                            }))
                          }
                          placeholder={`Optional Drive root URL for ${classRow.name}`}
                          aria-label={`Drive root URL for ${classRow.name}`}
                        />
                      ) : (
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          Select this class to configure its Drive folder.
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedClassIds.length} session{selectedClassIds.length === 1 ? "" : "s"} will be
                created atomically.
              </p>
            </fieldset>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !selectedLabId ||
                !name.trim() ||
                !selectedClassIds.length
              }
            >
              {createMutation.isPending
                ? "Creating…"
                : `Create ${selectedClassIds.length} session${selectedClassIds.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage session</DialogTitle>
            <DialogDescription>
              Update the session or close it to stop new grading writes.
            </DialogDescription>
          </DialogHeader>
          {editDraft ? (
            <div className="grid gap-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editDraft.name}
                  onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-deadline">Deadline</Label>
                <DateTimePicker
                  id="edit-deadline"
                  value={editDraft.deadline}
                  onChange={(value) => setEditDraft({ ...editDraft, deadline: value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-drive">Drive root URL</Label>
                <Input
                  id="edit-drive"
                  type="url"
                  value={editDraft.driveRootUrl}
                  onChange={(event) =>
                    setEditDraft({ ...editDraft, driveRootUrl: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={editDraft.status}
                  onValueChange={(value: GradingSessionStatus) =>
                    setEditDraft({ ...editDraft, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !editDraft?.name.trim()}
            >
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this session?</DialogTitle>
            <DialogDescription>
              Sessions with submissions cannot be deleted. Close them instead to preserve grading
              history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
