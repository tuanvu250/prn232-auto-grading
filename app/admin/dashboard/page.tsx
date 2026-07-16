"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminDashboardOverviewQueryOptions } from "@/lib/queries/admin";
import { OverviewPanel, type DashboardOverview } from "./components/OverviewPanel";

export default function AdminDashboardPage() {
  const { data: response, isPending, error } = useQuery(adminDashboardOverviewQueryOptions());

  useEffect(() => {
    if (error) toast.error("Unable to load the admin overview.");
  }, [error]);

  if (isPending) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error || !response?.success || !response.data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="border-destructive/40 p-6 text-sm text-destructive">
          {response?.error || error?.message || "Unable to load dashboard data."}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <OverviewPanel data={response.data as DashboardOverview} />
    </div>
  );
}
