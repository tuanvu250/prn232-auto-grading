"use client";

import { Calendar, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LabAssignment } from "@/lib/api/studentData";
import { StatusBadge } from "./StatusBadge";

interface LabListProps {
  labs: LabAssignment[];
  selectedLab: LabAssignment | null;
  loadingGrades: boolean;
  onSelectLab: (lab: LabAssignment) => void;
}

export function LabList({ labs, selectedLab, loadingGrades, onSelectLab }: LabListProps) {
  if (loadingGrades) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="border border-border bg-card rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <div className="space-y-1.5 items-end flex flex-col">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <div className="flex justify-between items-center pt-1">
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (labs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-card text-muted-foreground text-center gap-2">
        <p className="text-sm font-medium">No graded submissions yet</p>
        <p className="text-xs text-muted-foreground">
          Submit your work through the grading system and results will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {labs.map((lab, index) => {
        const isSelected = selectedLab?.id === lab.id;
        return (
          <button
            key={lab.id}
            onClick={() => onSelectLab(lab)}
            style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
            className={`w-full text-left rounded-lg border p-4 transition-all duration-200 motion-list-item ${
              isSelected
                ? "border-primary bg-primary/[0.02] shadow-sm"
                : "border-border bg-card hover:bg-muted/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <h3 className="break-words font-sans text-sm font-bold leading-tight">
                  {lab.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Due: {lab.dueDate}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-foreground">
                  {lab.status === "Grading" ? "--" : `${lab.currentScore.toFixed(1)}/10`}
                </p>
                <div className="mt-1">
                  <StatusBadge status={lab.status} />
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              {lab.weight > 0 ? <span>Weight: {lab.weight}%</span> : <span></span>}
              {isSelected && (
                <span className="flex items-center gap-0.5 text-primary font-medium">
                  Viewing <ChevronRight className="h-3 w-3" />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
