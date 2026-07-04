"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Code2, Plus, RefreshCw } from "lucide-react";

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
  getClassLabsForClassAction,
  getLabCatalogAction,
  createLabAction,
  assignLabToClassAction,
} from "@/lib/actions/erd-admin";
import type { ClassLab, Lab } from "@/lib/types/erd";

export default function AdminClassLabsPage() {
  const params = useParams<{ termId: string; classId: string }>();
  const router = useRouter();
  const [classLabs, setClassLabs] = useState<ClassLab[]>([]);
  const [catalog, setCatalog] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [existingLabId, setExistingLabId] = useState("");
  const [newLabCode, setNewLabCode] = useState("");
  const [newLabTitle, setNewLabTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [labs, allLabs] = await Promise.all([
        getClassLabsForClassAction(params.classId),
        getLabCatalogAction(),
      ]);
      setClassLabs(labs);
      setCatalog(allLabs);
    } catch (err) {
      console.error("Failed to load class labs:", err);
      toast.error("Unable to load labs.");
    } finally {
      setLoading(false);
    }
  }, [params.classId]);

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

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(`/admin/terms/${params.termId}/classes`)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Classes
            </Button>
            <Code2 className="h-5 w-5 text-primary" />
            <h1 className="text-sm font-bold text-foreground">Labs</h1>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Assign lab
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : classLabs.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No labs assigned yet.</Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classLabs.map((cl) => (
              <Link
                key={cl.id}
                href={`/admin/terms/${params.termId}/classes/${params.classId}/labs/${cl.id}/students`}
              >
                <Card className="h-full space-y-1 p-4 transition-colors hover:border-primary/40">
                  <p className="text-sm font-bold text-foreground">{cl.lab_code}</p>
                  {cl.lab_title ? (
                    <p className="text-xs text-muted-foreground">{cl.lab_title}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Deadline: {cl.deadline ? new Date(cl.deadline).toLocaleString() : "None"}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign lab to class</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Existing lab
              </label>
              <select
                value={existingLabId}
                onChange={(e) => setExistingLabId(e.target.value)}
                className="w-full rounded border border-border bg-background px-2.5 py-2 text-sm"
              >
                <option value="">— Create new lab instead —</option>
                {catalog.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.code} {lab.title ? `— ${lab.title}` : ""}
                  </option>
                ))}
              </select>
            </div>
            {!existingLabId ? (
              <>
                <Input
                  placeholder="New lab code (e.g. LAB1)"
                  value={newLabCode}
                  onChange={(e) => setNewLabCode(e.target.value)}
                />
                <Input
                  placeholder="Lab title (optional)"
                  value={newLabTitle}
                  onChange={(e) => setNewLabTitle(e.target.value)}
                />
              </>
            ) : null}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Deadline (optional)
              </label>
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={saving}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
