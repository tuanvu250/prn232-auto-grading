"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, RefreshCw, Users } from "lucide-react";

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
import { getClassesForTermAction, createClassAction } from "@/lib/actions/erd-admin";
import type { ClassRow } from "@/lib/types/erd";

export default function AdminClassesPage() {
  const params = useParams<{ termId: string }>();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setClasses(await getClassesForTermAction(params.termId));
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

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => router.push("/admin/terms")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Terms
            </Button>
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-sm font-bold text-foreground">Classes</h1>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New class
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : classes.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No classes in this term yet.</Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <Link
                key={cls.id}
                href={`/admin/terms/${params.termId}/classes/${cls.id}/labs`}
              >
                <Card className="h-full p-4 transition-colors hover:border-primary/40">
                  <p className="text-sm font-bold text-foreground">{cls.name}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create class</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Class name (e.g. SE1801)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
