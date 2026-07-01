"use client";

import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export interface AllowedEmail {
  email: string;
  student_id: string;
  class_name: string;
}

export interface ResubmissionRequest {
  id: string;
  student_id: string;
  email: string;
  name?: string | null;
  class_name?: string | null;
  lab_id: string;
  drive_link: string;
  note?: string | null;
  admin_note?: string | null;
  status: "pending" | "approved" | "rejected" | "completed";
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  completed_by?: string | null;
}

const emptyAccessForm = {
  email: "",
  studentId: "",
  className: "",
};

interface StudentAccessDialogProps {
  open: boolean;
  editingEmail: string | null;
  form: typeof emptyAccessForm;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (value: typeof emptyAccessForm) => void;
  onSave: () => void;
}

export function StudentAccessDialog({
  open,
  editingEmail,
  form,
  saving,
  onOpenChange,
  onFormChange,
  onSave,
}: StudentAccessDialogProps) {
  const canSave = form.email.trim() && form.studentId.trim() && form.className.trim() && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingEmail ? "Edit Student Access" : "Add Student Access"}</DialogTitle>
          <DialogDescription>
            The email must match the Google account the student uses to sign in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={form.email}
            onChange={(event) => onFormChange({ ...form, email: event.target.value })}
            placeholder="student@fpt.edu.vn"
            disabled={Boolean(editingEmail)}
            aria-label="Student email"
          />
          <Input
            value={form.studentId}
            onChange={(event) => onFormChange({ ...form, studentId: event.target.value })}
            placeholder="Student ID, for example SE182672"
            aria-label="Student ID"
          />
          <Input
            value={form.className}
            onChange={(event) => onFormChange({ ...form, className: event.target.value })}
            placeholder="Class, for example SE1815"
            aria-label="Class"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave}>
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editingEmail ? "Save Changes" : "Add Student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteStudentAccessDialogProps {
  target: AllowedEmail | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteStudentAccessDialog({
  target,
  onOpenChange,
  onConfirm,
}: DeleteStudentAccessDialogProps) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Student Access</DialogTitle>
          <DialogDescription>
            This removes the Google sign-in whitelist entry for {target?.email}. The student will no
            longer be able to access the dashboard.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete Access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RejectResubmissionDialogProps {
  target: ResubmissionRequest | null;
  note: string;
  saving: boolean;
  onNoteChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function RejectResubmissionDialog({
  target,
  note,
  saving,
  onNoteChange,
  onOpenChange,
  onConfirm,
}: RejectResubmissionDialogProps) {
  const canReject = note.trim().length > 0 && !saving;

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Resubmission Request</DialogTitle>
          <DialogDescription>
            Add a note for {target?.student_id} so the student knows what to fix before submitting
            again.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Explain why this resubmission is rejected"
          className="min-h-[120px]"
          aria-label="Reject note"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!canReject}>
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reject Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" | "completed" }) {
  const className =
    status === "pending"
      ? "border-none bg-amber-500 text-white hover:bg-amber-600"
      : status === "approved"
        ? "border-none bg-emerald-500 text-white hover:bg-emerald-600"
        : status === "completed"
          ? "border-none bg-sky-600 text-white hover:bg-sky-700"
          : "border-none bg-red-600 text-white hover:bg-red-700";

  return <Badge className={className}>{status}</Badge>;
}

export function EmptyTableRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-28 text-center text-sm text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}
