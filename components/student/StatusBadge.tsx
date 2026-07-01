"use client";

import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "Passed":
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none">
          Passed
        </Badge>
      );
    case "Failed":
      return (
        <Badge variant="destructive" className="border-none">
          Failed
        </Badge>
      );
    case "Grading":
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none animate-pulse">
          Grading
        </Badge>
      );
    default:
      return <Badge variant="outline">Not Submitted</Badge>;
  }
}
