import { queryOptions } from "@tanstack/react-query";

import { getAdminDashboardStatsAction, getAllowedEmailsAction } from "@/lib/actions/admin";
import {
  getAdminSessionSubmissionsAction,
  getAdminStudentSubmissionsAction,
  getClassesForTermAction,
  getClassStudentsForClassAction,
  getGradingSessionsForClassAction,
  getGradingSessionStudentResultsAction,
  getLabCatalogAction,
  getTermsAction,
} from "@/lib/actions/erd-admin";

export const adminQueryKeys = {
  all: ["admin"] as const,
  terms: () => [...adminQueryKeys.all, "terms"] as const,
  classes: (termId: string) => [...adminQueryKeys.all, "terms", termId, "classes"] as const,
  classWorkspace: (termId: string, classId: string) =>
    [...adminQueryKeys.classes(termId), classId, "sessions"] as const,
  sessionStudents: (termId: string, classId: string, sessionId: string) =>
    [...adminQueryKeys.classWorkspace(termId, classId), sessionId, "students"] as const,
  studentDetails: (termId: string, classId: string, sessionId: string, studentId: string) =>
    [...adminQueryKeys.sessionStudents(termId, classId, sessionId), studentId] as const,
  sessionSubmissions: (termId: string, classId: string, sessionId: string) =>
    [...adminQueryKeys.sessionStudents(termId, classId, sessionId), "all-submissions"] as const,
  dashboard: () => [...adminQueryKeys.all, "dashboard"] as const,
  dashboardOverview: () => [...adminQueryKeys.dashboard(), "overview"] as const,
  dashboardAccess: (filters: AdminAccessFilters) =>
    [...adminQueryKeys.dashboard(), "access", filters] as const,
};

export type AdminAccessFilters = {
  q?: string;
  className?: string;
  page: number;
  pageSize: number;
};

export function adminTermsQueryOptions() {
  return queryOptions({ queryKey: adminQueryKeys.terms(), queryFn: getTermsAction });
}

export function adminClassesQueryOptions(termId: string) {
  return queryOptions({
    queryKey: adminQueryKeys.classes(termId),
    queryFn: async () => {
      const [classes, terms] = await Promise.all([
        getClassesForTermAction(termId),
        getTermsAction(),
      ]);
      return { classes, termName: terms.find((item) => item.id === termId)?.name ?? "Term" };
    },
    enabled: Boolean(termId),
  });
}

export function adminClassWorkspaceQueryOptions(termId: string, classId: string) {
  return queryOptions({
    queryKey: adminQueryKeys.classWorkspace(termId, classId),
    queryFn: async () => {
      const [sessions, students, catalog, classes, terms] = await Promise.all([
        getGradingSessionsForClassAction(classId),
        getClassStudentsForClassAction(classId),
        getLabCatalogAction(),
        getClassesForTermAction(termId),
        getTermsAction(),
      ]);
      return {
        sessions,
        students,
        catalog,
        classes,
        className: classes.find((item) => item.id === classId)?.name ?? "Class",
        termName: terms.find((item) => item.id === termId)?.name ?? "Term",
      };
    },
    enabled: Boolean(termId && classId),
  });
}

export function adminSessionStudentsQueryOptions(
  termId: string,
  classId: string,
  sessionId: string
) {
  return queryOptions({
    queryKey: adminQueryKeys.sessionStudents(termId, classId, sessionId),
    queryFn: async () => {
      const [results, sessions, classes, terms] = await Promise.all([
        getGradingSessionStudentResultsAction(sessionId),
        getGradingSessionsForClassAction(classId),
        getClassesForTermAction(termId),
        getTermsAction(),
      ]);
      return {
        results,
        session: sessions.find((item) => item.id === sessionId) ?? null,
        className: classes.find((item) => item.id === classId)?.name ?? "Class",
        termName: terms.find((item) => item.id === termId)?.name ?? "Term",
      };
    },
    enabled: Boolean(termId && classId && sessionId),
  });
}

export function adminStudentDetailsQueryOptions(
  termId: string,
  classId: string,
  sessionId: string,
  classStudentId: string,
  hasAttempts: boolean
) {
  return queryOptions({
    queryKey: adminQueryKeys.studentDetails(termId, classId, sessionId, classStudentId),
    queryFn: () =>
      hasAttempts
        ? getAdminStudentSubmissionsAction(classStudentId, sessionId)
        : Promise.resolve([]),
  });
}

export function adminSessionSubmissionsQueryOptions(
  termId: string,
  classId: string,
  sessionId: string
) {
  return queryOptions({
    queryKey: adminQueryKeys.sessionSubmissions(termId, classId, sessionId),
    queryFn: () => getAdminSessionSubmissionsAction(sessionId),
  });
}

export function adminDashboardOverviewQueryOptions() {
  return queryOptions({
    queryKey: adminQueryKeys.dashboardOverview(),
    queryFn: getAdminDashboardStatsAction,
  });
}

export function adminDashboardAccessQueryOptions(filters: AdminAccessFilters) {
  return queryOptions({
    queryKey: adminQueryKeys.dashboardAccess(filters),
    queryFn: () => getAllowedEmailsAction(filters),
  });
}
