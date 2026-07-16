"use client";

import { useCallback, useMemo, useState } from "react";
import { FileSpreadsheet, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { importClassStudentsAction } from "@/lib/actions/erd-admin";
import { cn } from "@/lib/utils";

type SheetGrid = string[][];
type ColumnMapping = { studentCode: string; email: string; name: string };
type ImportPreviewRow = {
  rowNumber: number;
  studentCode: string;
  email: string;
  name: string;
  errors: string[];
};

type ImportStudentsExcelDialogProps = {
  classId: string;
  className: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<unknown> | unknown;
};

const emptyMapping: ColumnMapping = { studentCode: "", email: "", name: "" };
const NO_COLUMN_VALUE = "__no_column__";

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ");
}

function autoDetectMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const findHeader = (candidates: string[]) => {
    const exactIndex = normalized.findIndex((header) => candidates.includes(header));
    if (exactIndex >= 0) return headers[exactIndex];
    const fuzzyIndex = normalized.findIndex((header) =>
      candidates.some((candidate) => header.includes(candidate))
    );
    return fuzzyIndex >= 0 ? headers[fuzzyIndex] : "";
  };

  return {
    studentCode: findHeader([
      "student code",
      "student id",
      "studentid",
      "mssv",
      "ma sv",
      "masv",
      "code",
    ]),
    email: findHeader(["email", "mail", "student email"]),
    name: findHeader(["full name", "student name", "name", "ho ten", "hoten"]),
  };
}

function buildImportPreview(
  rows: SheetGrid,
  headers: string[],
  headerRow: number,
  mapping: ColumnMapping
): ImportPreviewRow[] {
  const indexes = {
    studentCode: headers.indexOf(mapping.studentCode),
    email: headers.indexOf(mapping.email),
    name: headers.indexOf(mapping.name),
  };
  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();

  return rows.slice(headerRow).map((row, index) => {
    const studentCode = String(row[indexes.studentCode] || "")
      .trim()
      .toUpperCase();
    const email = String(row[indexes.email] || "")
      .trim()
      .toLowerCase();
    const name = String(row[indexes.name] || "").trim();
    const errors: string[] = [];

    if (!studentCode) errors.push("Missing student code");
    if (!email) errors.push("Missing email");
    if (!name) errors.push("Missing full name");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Invalid email");
    if (studentCode && seenCodes.has(studentCode)) errors.push("Duplicate student code");
    if (email && seenEmails.has(email)) errors.push("Duplicate email");
    if (studentCode) seenCodes.add(studentCode);
    if (email) seenEmails.add(email);

    return { rowNumber: index + 1, studentCode, email, name, errors };
  });
}

export function ImportStudentsExcelDialog({
  classId,
  className,
  open,
  onOpenChange,
  onImported,
}: ImportStudentsExcelDialogProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [workbookSheets, setWorkbookSheets] = useState<Record<string, SheetGrid>>({});
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(emptyMapping);

  const reset = useCallback(() => {
    setWorkbookSheets({});
    setSheetNames([]);
    setSelectedSheet("");
    setHeaderRow(1);
    setHeaders([]);
    setColumnMapping(emptyMapping);
    setIsDragging(false);
  }, []);

  const applySheetHeaders = (sheetName: string, nextHeaderRow: number, sheets = workbookSheets) => {
    const rows = sheets[sheetName] || [];
    const nextHeaders = (rows[Math.max(nextHeaderRow - 1, 0)] || [])
      .map((cell) => String(cell || "").trim())
      .filter(Boolean);
    setHeaders(nextHeaders);
    setColumnMapping(autoDetectMapping(nextHeaders));
  };

  const selectedRows = useMemo(
    () => workbookSheets[selectedSheet] || [],
    [selectedSheet, workbookSheets]
  );
  const preview = useMemo(
    () => buildImportPreview(selectedRows, headers, headerRow, columnMapping),
    [columnMapping, headerRow, headers, selectedRows]
  );
  const validRows = preview.filter((row) => row.errors.length === 0);
  const invalidCount = preview.length - validRows.length;
  const canImport =
    validRows.length > 0 &&
    Boolean(columnMapping.studentCode && columnMapping.email && columnMapping.name) &&
    !isParsing &&
    !isImporting;

  const readExcel = async (file: File | null) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("Please choose an .xlsx or .xls file.");
      return;
    }

    setIsParsing(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      if (!workbook.SheetNames.length) throw new Error("No sheets found in this workbook.");

      const sheets: Record<string, SheetGrid> = {};
      workbook.SheetNames.forEach((sheetName) => {
        const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
          workbook.Sheets[sheetName],
          { header: 1, defval: "", blankrows: false }
        );
        sheets[sheetName] = rows.map((row) => row.map((cell) => String(cell ?? "")));
      });

      setWorkbookSheets(sheets);
      setSheetNames(workbook.SheetNames);
      setSelectedSheet(workbook.SheetNames[0]);
      setHeaderRow(1);
      applySheetHeaders(workbook.SheetNames[0], 1, sheets);
      toast.success(
        `Loaded ${workbook.SheetNames.length} sheet${workbook.SheetNames.length > 1 ? "s" : ""}.`
      );
    } catch (error) {
      reset();
      toast.error(error instanceof Error ? error.message : "Unable to read Excel file.");
    } finally {
      setIsParsing(false);
    }
  };

  const importStudents = async () => {
    setIsImporting(true);
    try {
      const result = await importClassStudentsAction(
        classId,
        validRows.map(({ studentCode, email, name }) => ({ studentCode, email, name }))
      );
      toast.success(
        `Imported ${result.imported} student${result.imported === 1 ? "" : "s"}${result.skipped ? `, skipped ${result.skipped}` : ""}.`
      );
      await onImported();
      onOpenChange(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import students.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogContent className="flex h-[calc(100dvh-2rem)] max-h-[760px] max-w-5xl flex-col overflow-hidden border border-border bg-card p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>Import Students from Excel</DialogTitle>
          <DialogDescription>
            Select a sheet, map its columns, then import valid rows into {className || "this class"}
            .
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-3">
          <label
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-muted/20 transition-colors",
              isDragging && "border-primary bg-primary/5",
              sheetNames.length ? "p-2.5" : "min-h-40 justify-center p-6 text-center"
            )}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!isParsing && !isImporting) setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              if (!isParsing && !isImporting) void readExcel(event.dataTransfer.files?.[0] || null);
            }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              {isParsing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </span>
            <span>
              <span className="block text-sm font-semibold">
                {isParsing ? "Reading workbook..." : "Drag Excel here or choose a file"}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Supports .xlsx and .xls. Columns can be mapped after upload.
              </span>
            </span>
            <Input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={isParsing || isImporting}
              onChange={(event) => void readExcel(event.target.files?.[0] || null)}
            />
          </label>

          {sheetNames.length ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Sheet</label>
                  <Select
                    value={selectedSheet}
                    onValueChange={(value) => {
                      setSelectedSheet(value);
                      setHeaderRow(1);
                      applySheetHeaders(value, 1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetNames.map((sheetName) => (
                        <SelectItem key={sheetName} value={sheetName}>
                          {sheetName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Header Row</label>
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(selectedRows.length, 1)}
                    value={headerRow}
                    onChange={(event) => {
                      const nextHeaderRow = Math.max(Number(event.target.value) || 1, 1);
                      setHeaderRow(nextHeaderRow);
                      applySheetHeaders(selectedSheet, nextHeaderRow);
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {(
                  [
                    ["studentCode", "Student Code"],
                    ["email", "Email"],
                    ["name", "Full Name"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                    <Select
                      value={columnMapping[key] || NO_COLUMN_VALUE}
                      onValueChange={(value) =>
                        setColumnMapping((current) => ({
                          ...current,
                          [key]: value === NO_COLUMN_VALUE ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_COLUMN_VALUE}>Select column</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Rows: {preview.length}</Badge>
                <Badge className="border-0 bg-emerald-500/10 text-emerald-700">
                  Valid: {validRows.length}
                </Badge>
                <Badge className="border-0 bg-red-500/10 text-red-700">
                  Invalid: {invalidCount}
                </Badge>
              </div>

              <div className="min-h-36 flex-1 overflow-auto rounded-lg border border-border">
                <Table className="min-w-[760px]">
                  <TableHeader className="sticky top-0 z-10 bg-muted">
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Student Code</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                        <TableCell className="font-mono text-xs font-semibold">
                          {row.studentCode || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{row.email || "—"}</TableCell>
                        <TableCell className="text-sm">{row.name || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              row.errors.length
                                ? "border-0 bg-red-500/10 text-red-700"
                                : "border-0 bg-emerald-500/10 text-emerald-700"
                            }
                          >
                            {row.errors.length ? row.errors.join(", ") : "Valid"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-card px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={() => void importStudents()} disabled={!canImport}>
            {isImporting ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Import Students
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
