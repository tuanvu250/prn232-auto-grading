import Link from "next/link";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type {
  ClassGradeMatrixResult,
  ClassStudentRosterRow,
  GradingSession,
} from "@/lib/types/erd";

type GradeMatrixProps = {
  termId: string;
  classId: string;
  sessions: GradingSession[];
  students: ClassStudentRosterRow[];
  results: ClassGradeMatrixResult[];
  emptyMessage: string;
};

function scoreLabel(score: number | null) {
  return score === null ? "—" : score.toFixed(2);
}

export function GradeMatrix({
  termId,
  classId,
  sessions,
  students,
  results,
  emptyMessage,
}: GradeMatrixProps) {
  const resultByCell = new Map(
    results.map((result) => [`${result.class_student_id}:${result.grading_session_id}`, result])
  );

  return (
    <ScrollArea
      type="always"
      className="relative min-h-0 flex-1 border border-border bg-background"
    >
      <table className="w-max min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-20 bg-muted/40">
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-30 h-14 w-32 min-w-32 border-b border-r border-border bg-muted px-4 text-left font-semibold text-foreground"
            >
              Student ID
            </th>
            <th
              scope="col"
              className="h-14 w-56 min-w-56 border-b border-r border-border bg-muted px-4 text-left font-semibold text-foreground md:sticky md:left-32 md:z-30"
            >
              Full name
            </th>
            <th
              scope="col"
              className="h-14 w-64 min-w-64 border-b border-r border-border bg-muted/80 px-4 text-left font-semibold text-foreground"
            >
              Email
            </th>
            {sessions.map((session) => (
              <th
                key={session.id}
                scope="col"
                title={`${session.lab_code} · ${session.name}`}
                className="h-14 w-40 min-w-40 border-b border-r border-border bg-muted/80 px-3 text-center last:border-r-0"
              >
                <span className="block truncate font-semibold text-foreground">
                  {session.lab_code}
                </span>
                <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                  {session.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.length ? (
            students.map((student) => (
              <tr
                key={student.class_student_id}
                className="group border-b border-border last:border-b-0"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 h-12 border-r border-border bg-background px-4 text-left font-mono text-xs font-semibold tabular-nums group-hover:bg-muted/30"
                >
                  {student.student_code}
                </th>
                <td className="h-12 border-r border-border bg-background px-4 font-medium group-hover:bg-muted/30 md:sticky md:left-32 md:z-10">
                  <span
                    className="block max-w-48 truncate"
                    title={student.student_name ?? student.student_email}
                  >
                    {student.student_name || student.student_email}
                  </span>
                </td>
                <td className="h-12 border-r border-border px-4 font-mono text-xs text-muted-foreground group-hover:bg-muted/20">
                  <span className="block max-w-56 truncate" title={student.student_email}>
                    {student.student_email}
                  </span>
                </td>
                {sessions.map((session) => {
                  const result = resultByCell.get(`${student.class_student_id}:${session.id}`);
                  const label = scoreLabel(result?.latest_score ?? null);

                  return (
                    <td
                      key={session.id}
                      className="h-12 border-r border-border p-0 text-center last:border-r-0 group-hover:bg-muted/20"
                    >
                      {result ? (
                        <Link
                          href={`/admin/terms/${termId}/classes/${classId}/sessions/${session.id}/students?student=${student.class_student_id}`}
                          className="flex h-12 w-full items-center justify-center px-3 font-mono font-semibold tabular-nums text-foreground outline-none transition-colors hover:bg-primary/5 hover:text-primary focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                          aria-label={`View ${session.name} submission details for ${student.student_code}, latest score ${label}`}
                          title={`${result.attempt_count} attempt${result.attempt_count === 1 ? "" : "s"} · View details`}
                        >
                          {label}
                        </Link>
                      ) : (
                        <span
                          className="font-mono text-muted-foreground"
                          aria-label="No submission"
                        >
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={Math.max(3, sessions.length + 3)}
                className="h-40 px-6 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <ScrollBar orientation="horizontal" />
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
}
