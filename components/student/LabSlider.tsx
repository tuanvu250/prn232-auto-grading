"use client";

import { Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LabAssignment } from "@/lib/api/studentData";
import { StatusBadge } from "./StatusBadge";

interface LabSliderProps {
  labs: LabAssignment[];
  selectedLab: LabAssignment | null;
  loadingGrades: boolean;
  onSelectLab: (lab: LabAssignment, scrollToDetail: boolean) => void;
}

export function LabSlider({ labs, selectedLab, loadingGrades, onSelectLab }: LabSliderProps) {
  if (loadingGrades) {
    return (
      <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        <div className="flex snap-x snap-mandatory gap-3 animate-pulse">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={idx}
              className="min-h-[116px] w-[78vw] max-w-[320px] shrink-0 snap-start rounded-lg border border-border bg-card p-4 text-left sm:w-[300px] flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (labs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-4 text-muted-foreground">
        <p className="text-sm font-medium">No graded submissions yet</p>
        <p className="mt-1 text-xs">Results will appear here after grading is complete.</p>
      </div>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
      <div className="flex snap-x snap-mandatory gap-3">
        {labs.map((lab, index) => {
          const isSelected = selectedLab?.id === lab.id;
          return (
            <button
              key={lab.id}
              onClick={() => onSelectLab(lab, true)}
              style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
              className={`min-h-[116px] w-[78vw] max-w-[320px] shrink-0 snap-start rounded-lg border p-4 text-left transition-all duration-200 sm:w-[300px] motion-list-item ${
                isSelected ? "border-primary bg-primary/[0.03]" : "border-border bg-card"
              }`}
            >
              <div className="flex h-full flex-col justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 break-words text-sm font-bold leading-tight text-foreground">
                      {lab.title}
                    </h3>
                    {isSelected && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Viewing
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span className="truncate">Due: {lab.dueDate}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-extrabold text-foreground">
                    {lab.status === "Grading" ? "--" : `${lab.currentScore.toFixed(1)}/10`}
                  </span>
                  <StatusBadge status={lab.status} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
