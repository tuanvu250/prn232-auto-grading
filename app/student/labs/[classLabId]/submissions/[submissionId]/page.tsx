"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function SubmissionDetailRedirectPage() {
  const router = useRouter();
  const params = useParams<{ classLabId: string; submissionId: string }>();

  useEffect(() => {
    if (params?.classLabId && params?.submissionId) {
      router.replace(
        `/student/labs/${params.classLabId}?submissionId=${params.submissionId}`
      );
    }
  }, [router, params]);

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-6 font-quicksand">
      <div className="w-full max-w-5xl space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-6">
            <Card className="p-4 flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-48" />
            </Card>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 3 }).map((_, idx) => (
              <Card key={idx} className="p-3 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-3/4" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}