"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface TablePaginationProps {
  className?: string;
  fullBleed?: boolean;
  pagination: PaginationMeta;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function TablePagination({
  className,
  fullBleed = false,
  pagination,
  loading,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.total, pagination.page * pagination.pageSize);
  const canPrevious = pagination.page > 1 && !loading;
  const canNext = pagination.page < pagination.totalPages && !loading;

  return (
    <div
      className={cn(
        "mt-auto flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between",
        fullBleed && "-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        className
      )}
    >
      <div className="text-sm text-muted-foreground">
        Showing {start}-{end} of {pagination.total}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            disabled={loading}
          >
            <SelectTrigger className="h-9 w-[88px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="min-w-[96px] text-center text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={!canPrevious}
              onClick={() => onPageChange(1)}
              title="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canPrevious}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canNext}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={!canNext}
              onClick={() => onPageChange(pagination.totalPages)}
              title="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
