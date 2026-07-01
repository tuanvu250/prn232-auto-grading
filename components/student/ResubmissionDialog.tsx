"use client";

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
import { LabAssignment } from "@/lib/api/studentData";

export interface ResubmissionRequest {
  id: string;
  lab_id: string;
  drive_link: string;
  note?: string | null;
  admin_note?: string | null;
  status: "pending" | "approved" | "rejected" | "completed";
  updated_at: string;
  completed_at?: string | null;
}

interface ResubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLab: LabAssignment | null;
  driveLink: string;
  onDriveLinkChange: (value: string) => void;
  resubmitNote: string;
  onResubmitNoteChange: (value: string) => void;
  saving: boolean;
  onSave: () => void;
  currentRequest: ResubmissionRequest | null;
}

const isDriveLink = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "drive.google.com" || parsed.hostname.endsWith(".drive.google.com");
  } catch {
    return false;
  }
};

export function ResubmissionDialog({
  open,
  onOpenChange,
  selectedLab,
  driveLink,
  onDriveLinkChange,
  resubmitNote,
  onResubmitNoteChange,
  saving,
  onSave,
  currentRequest,
}: ResubmissionDialogProps) {
  if (!selectedLab) return null;

  const isValidLink = driveLink.trim() && isDriveLink(driveLink);
  const canSubmit = isValidLink && !saving;
  const isEditing = Boolean(currentRequest && currentRequest.status === "pending");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Lab Resubmission</DialogTitle>
          <DialogDescription>
            Submit your Google Drive zip file link for **{selectedLab.title}**. Make sure the folder is
            shared to anyone with the link so the automated grader can access it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {currentRequest?.status === "rejected" && currentRequest.admin_note && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-300 flex items-start gap-2 animate-shake">
              <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Feedback from admin:</span> {currentRequest.admin_note}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Google Drive Link</span>
            <Input
              value={driveLink}
              onChange={(e) => onDriveLinkChange(e.target.value)}
              placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
              disabled={saving}
              aria-label="Google Drive Link"
            />
            {driveLink && !isDriveLink(driveLink) && (
              <p className="text-[10px] font-medium text-destructive">
                Must be a valid Google Drive URL
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Note (Optional)</span>
            <Textarea
              value={resubmitNote}
              onChange={(e) => onResubmitNoteChange(e.target.value)}
              placeholder="Add details on what you modified or debugged"
              className="min-h-[80px]"
              disabled={saving}
              aria-label="Note"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSubmit}>
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? "Update Request" : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
