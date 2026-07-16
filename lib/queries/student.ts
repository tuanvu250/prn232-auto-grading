import { queryOptions } from "@tanstack/react-query";

import {
  getGradingSessionAccessAction,
  getSessionAttemptsAction,
  getStudentSessionOverviewAction,
} from "@/lib/actions/erd-student";

export const studentQueryKeys = {
  all: ["student"] as const,
  sessionOverview: () => [...studentQueryKeys.all, "session-overview"] as const,
  session: (sessionId: string) => [...studentQueryKeys.all, "session", sessionId] as const,
};

export function studentSessionOverviewQueryOptions() {
  return queryOptions({
    queryKey: studentQueryKeys.sessionOverview(),
    queryFn: getStudentSessionOverviewAction,
    staleTime: 60_000,
  });
}

export function studentSessionQueryOptions(sessionId: string) {
  return queryOptions({
    queryKey: studentQueryKeys.session(sessionId),
    queryFn: async () => {
      const [attempts, sessionAccess] = await Promise.all([
        getSessionAttemptsAction(sessionId),
        getGradingSessionAccessAction(sessionId),
      ]);
      return { attempts, sessionAccess };
    },
    staleTime: 30_000,
    enabled: Boolean(sessionId),
  });
}
