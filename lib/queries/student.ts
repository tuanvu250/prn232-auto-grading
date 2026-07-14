import { queryOptions } from "@tanstack/react-query";

import {
  getClassLabAttemptsAction,
  getClassLabSubmissionAccessAction,
  getResubmissionRequestForClassLabAction,
  getStudentLabOverviewAction,
} from "@/lib/actions/erd-student";

export const studentQueryKeys = {
  all: ["student"] as const,
  labOverview: () => [...studentQueryKeys.all, "lab-overview"] as const,
  classLab: (classLabId: string) =>
    [...studentQueryKeys.all, "class-lab", classLabId] as const,
};

export function studentLabOverviewQueryOptions() {
  return queryOptions({
    queryKey: studentQueryKeys.labOverview(),
    queryFn: getStudentLabOverviewAction,
    staleTime: 60_000,
  });
}

export function studentClassLabQueryOptions(classLabId: string) {
  return queryOptions({
    queryKey: studentQueryKeys.classLab(classLabId),
    queryFn: async () => {
      const [attempts, request, labAccess] = await Promise.all([
        getClassLabAttemptsAction(classLabId),
        getResubmissionRequestForClassLabAction(classLabId),
        getClassLabSubmissionAccessAction(classLabId),
      ]);

      return { attempts, request, labAccess };
    },
    staleTime: 30_000,
    enabled: Boolean(classLabId),
  });
}
