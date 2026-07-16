"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AllowedEmail {
  email: string;
  student_id: string;
  class_name: string;
  name?: string | null;
}

const emptyAccessForm = {
  email: "",
  studentId: "",
  className: "",
  name: "",
};

const CREATE_CLASS_VALUE = "__create_class__";

interface StudentAccessDialogProps {
  open: boolean;
  editingEmail: string | null;
  form: typeof emptyAccessForm;
  saving: boolean;
  classNames: string[];
  onOpenChange: (open: boolean) => void;
  onFormChange: (value: typeof emptyAccessForm) => void;
  onSave: () => void;
}

export function StudentAccessDialog({
  open,
  editingEmail,
  form,
  saving,
  classNames,
  onOpenChange,
  onFormChange,
  onSave,
}: StudentAccessDialogProps) {
  const [creatingClass, setCreatingClass] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCreatingClass(false);
    }
    onOpenChange(nextOpen);
  };

  const canSave =
    form.email.trim() &&
    form.studentId.trim() &&
    form.className.trim() &&
    form.name.trim() &&
    !saving;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingEmail ? "Edit Student" : "Add Student"}</DialogTitle>
          <DialogDescription>
            Enter the details of the student. The email must match their Google sign-in account.
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
            value={form.name}
            onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            placeholder="Full Name, for example Nguyen Van A"
            aria-label="Student name"
          />
          <Input
            value={form.studentId}
            onChange={(event) => onFormChange({ ...form, studentId: event.target.value })}
            placeholder="Student ID, for example SE182672"
            aria-label="Student ID"
          />

          <Select
            value={creatingClass ? CREATE_CLASS_VALUE : form.className}
            onValueChange={(val) => {
              if (val === CREATE_CLASS_VALUE) {
                setCreatingClass(true);
                onFormChange({ ...form, className: "" });
                return;
              }

              setCreatingClass(false);
              onFormChange({ ...form, className: val });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CREATE_CLASS_VALUE} className="font-medium text-primary">
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  Create new class
                </span>
              </SelectItem>
              {(classNames || []).map((cName) => (
                <SelectItem key={cName} value={cName}>
                  {cName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {creatingClass ? (
            <Input
              value={form.className}
              onChange={(event) => onFormChange({ ...form, className: event.target.value })}
              placeholder="New class name, for example SE1827"
              aria-label="New class name"
            />
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
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

export function EmptyTableRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-28 text-center text-sm text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}
