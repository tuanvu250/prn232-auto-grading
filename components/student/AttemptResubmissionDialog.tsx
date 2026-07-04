"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createResubmissionRequestAction } from "@/lib/actions/erd-student";
import type { StudentClassLabOverview } from "@/lib/types/erd";

interface AttemptResubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labs: StudentClassLabOverview[];
  onSaved: () => void;
}

// The lab select intentionally starts empty (no preselected/default value) even when
// opened from a specific lab's page — per Phase 6 requirement, the student must
// explicitly pick the lab every time, never inherit "the lab currently being viewed".
export function AttemptResubmissionDialog({
  open,
  onOpenChange,
  labs,
  onSaved,
}: AttemptResubmissionDialogProps) {
  const [classLabId, setClassLabId] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = classLabId !== "" && driveLink.trim().length > 0 && !saving;

  const reset = () => {
    setClassLabId("");
    setDriveLink("");
    setNote("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await createResubmissionRequestAction(classLabId, driveLink, note);
      if (!result.success) {
        toast.error(result.error || "Unable to submit the resubmission request.");
        return;
      }
      toast.success("Resubmission request sent. Admins will be notified.");
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error("Failed to save resubmission request:", err);
      toast.error("Unable to reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Resubmission</DialogTitle>
          <DialogDescription>
            Pick the lab you want re-graded and submit a Google Drive link. You may request a
            resubmission up to 3 times per lab.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50/50 p-3.5 text-sm leading-relaxed text-red-800 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-200">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-100/80 text-red-600 dark:bg-red-950 dark:text-red-400">
              <TriangleAlert className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-red-800 dark:text-red-300">Important Note</p>
              <p className="mt-0.5 text-xs text-red-700 dark:text-red-400 font-medium">
                Please do not spam requests. Kindly wait for the admin to review and process your
                submission.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Lab</label>
            <select
              value={classLabId}
              onChange={(event) => setClassLabId(event.target.value)}
              className="w-full rounded border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Select lab to request resubmission for"
            >
              <option value="" disabled>
                Select a lab...
              </option>
              {labs.map((lab) => (
                <option key={lab.class_lab_id} value={lab.class_lab_id}>
                  {lab.lab_code} {lab.lab_title ? `— ${lab.lab_title}` : ""}
                </option>
              ))}
            </select>
          </div>

          <Input
            value={driveLink}
            onChange={(event) => setDriveLink(event.target.value)}
            placeholder="https://drive.google.com/..."
            aria-label="Google Drive resubmission link"
          />
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note for admin"
            className="min-h-[96px]"
            aria-label="Resubmission note"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSubmit}>
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
