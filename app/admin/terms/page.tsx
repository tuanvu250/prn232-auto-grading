"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, Plus, RefreshCw } from "lucide-react";

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
import { getTermsAction, createTermAction } from "@/lib/actions/erd-admin";
import type { Term } from "@/lib/types/erd";

export default function AdminTermsPage() {
  const router = useRouter();
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTerms(await getTermsAction());
    } catch (err) {
      console.error("Failed to load terms:", err);
      toast.error("Unable to load terms.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      load();
    } catch (err) {
      console.error("Failed to create term:", err);
      toast.error("Unable to create term.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => router.push("/admin/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Admin
            </Button>
            <GraduationCap className="h-5 w-5 text-primary" />
            <h1 className="text-sm font-bold text-foreground">Terms</h1>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New term
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : terms.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No terms yet.</Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {terms.map((term) => (
              <Link key={term.id} href={`/admin/terms/${term.id}/classes`}>
                <Card className="h-full space-y-1 p-4 transition-colors hover:border-primary/40">
                  <p className="text-sm font-bold text-foreground">{term.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {term.starts_on || "?"} → {term.ends_on || "?"}
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
            <DialogTitle>Create term</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              placeholder="Term name (e.g. SP26)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </div>
          </div>
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
