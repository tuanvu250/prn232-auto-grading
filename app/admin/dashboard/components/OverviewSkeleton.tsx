"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function OverviewSkeleton() {
  return (
    <div className="space-y-6 font-quicksand">
      {/* Page Title Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 sm:h-9" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="p-6 bg-card border border-border rounded-lg flex items-center justify-between"
          >
            <div className="space-y-2.5 flex-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3.5 w-32" />
            </div>
            <Skeleton className="h-11 w-11 rounded-lg shrink-0 ml-4" />
          </div>
        ))}
      </div>

      {/* Main Charts & Analytics Section Skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart Skeleton */}
        <div className="lg:col-span-2 p-6 bg-card border border-border rounded-lg flex flex-col space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4.5 w-48" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
          <div className="h-[250px] w-full flex items-end gap-4 px-2 pt-4">
            {/* Visual simulation of bar chart columns loading */}
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="flex-1 flex items-end gap-1.5 h-full">
                <Skeleton
                  className="w-full rounded-t"
                  style={{ height: `${20 + Math.random() * 60}%` }}
                />
                <Skeleton
                  className="w-full rounded-t bg-muted/30"
                  style={{ height: `${10 + Math.random() * 40}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Diagnostic Status Skeleton */}
        <div className="p-6 bg-card border border-border rounded-lg flex flex-col justify-between h-full space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4.5 w-36" />
              <Skeleton className="h-3.5 w-64 max-w-full" />
            </div>

            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50"
                >
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-3.5 w-12" />
                </div>
              ))}
            </div>
          </div>

          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>

      {/* Recent Activities Section Skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Column 1: Recent Resubmissions Skeleton */}
        <div className="p-6 bg-card border border-border rounded-lg space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-4.5 w-12" />
          </div>

          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 py-1">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <Skeleton className="h-3 w-48 max-w-full" />
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Recent Submissions Skeleton */}
        <div className="p-6 bg-card border border-border rounded-lg space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-60 max-w-full" />
            </div>
            <Skeleton className="h-3.5 w-16" />
          </div>

          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 py-1">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-3 w-44 max-w-full" />
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
