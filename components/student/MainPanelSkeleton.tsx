"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function MainPanelSkeleton() {
  return (
    <Card className="border-border bg-card shadow-sm h-full flex flex-col">
      <CardContent className="min-w-0 flex-1 p-3 sm:p-6 space-y-6 animate-pulse">
        {/* Page Header Skeleton */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-6">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-48 sm:h-8" />
            <div className="flex gap-2 flex-wrap">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted/40 p-3 flex justify-between">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/12" />
              <Skeleton className="h-4 w-1/12" />
              <Skeleton className="h-4 w-1/12" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="p-3 flex justify-between">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-4 w-1/12" />
                  <Skeleton className="h-4 w-1/12" />
                  <Skeleton className="h-4 w-1/12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
