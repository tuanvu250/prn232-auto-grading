import { queryOptions } from "@tanstack/react-query";

import {
  getAdminDashboardStatsAction,
  getAdminResubmissionsAction,
  getAllowedEmailsAction,
} from "@/lib/actions/admin";

import {
  getClassesForTermAction,
  getAdminClassLabSubmissionsAction,
  getAdminStudentResubmissionsAction,
  getAdminStudentSubmissionsAction,
  getClassLabsForClassAction,
  getClassLabStudentResultsAction,
  getClassStudentsForClassAction,
  getLabCatalogAction,
  getTermsAction,
} from "@/lib/actions/erd-admin";

export const adminQueryKeys = {
  all: ["admin"] as const,
  terms: () => [...adminQueryKeys.all, "terms"] as const,
  classes: (termId: string) =>
    [...adminQueryKeys.all, "terms", termId, "classes"] as const,
  classWorkspace: (termId: string, classId: string) =>
    [...adminQueryKeys.classes(termId), classId, "workspace"] as const,
  classLabStudents: (termId: string, classId: string, classLabId: string) =>
    [...adminQueryKeys.classWorkspace(termId, classId), "labs", classLabId, "students"] as const,
  studentDetails: (termId: string, classId: string, classLabId: string, classStudentId: string) =>
    [...adminQueryKeys.classLabStudents(termId, classId, classLabId), classStudentId] as const,
  classLabSubmissions: (termId: string, classId: string, classLabId: string) =>
    [...adminQueryKeys.classLabStudents(termId, classId, classLabId), "all-submissions"] as const,
  dashboard: () => [...adminQueryKeys.all, "dashboard"] as const,
  dashboardOverview: () => [...adminQueryKeys.dashboard(), "overview"] as const,
  dashboardResubmissions: (filters: AdminResubmissionFilters) =>
    [...adminQueryKeys.dashboard(), "resubmissions", filters] as const,
  dashboardAccess: (filters: AdminAccessFilters) =>
    [...adminQueryKeys.dashboard(), "access", filters] as const,
};

export type AdminResubmissionFilters = {
  status: string;
  q?: string;
  page: number;
  pageSize: number;
};

export type AdminAccessFilters = {
  q?: string;
  className?: string;
  page: number;
  pageSize: number;
};

export function adminTermsQueryOptions() {
  return queryOptions({
    queryKey: adminQueryKeys.terms(),
    queryFn: getTermsAction,
  });
}

export function adminClassesQueryOptions(termId: string) {
  return queryOptions({
    queryKey: adminQueryKeys.classes(termId),
    queryFn: async () => {
      const [classes, terms] = await Promise.all([
        getClassesForTermAction(termId),
        getTermsAction(),
      ]);
      const term = terms.find((item) => item.id === termId);
      return { classes, termName: term?.name ?? "Term" };
    },
    enabled: Boolean(termId),
  });
}

export function adminClassWorkspaceQueryOptions(termId: string, classId: string) {
  return queryOptions({
    queryKey: adminQueryKeys.classWorkspace(termId, classId),
    queryFn: async () => {
      const [classLabs, students, catalog, classes, terms] = await Promise.all([
        getClassLabsForClassAction(classId),
        getClassStudentsForClassAction(classId),
        getLabCatalogAction(),
        getClassesForTermAction(termId),
        getTermsAction(),
      ]);
      return {
        classLabs,
        students,
        catalog,
        className: classes.find((item) => item.id === classId)?.name ?? "Class",
        termName: terms.find((item) => item.id === termId)?.name ?? "Term",
      };
    },
    enabled: Boolean(termId && classId),
  });
}

export function adminClassLabStudentsQueryOptions(
  termId: string,
  classId: string,
  classLabId: string
) {
  return queryOptions({
    queryKey: adminQueryKeys.classLabStudents(termId, classId, classLabId),
    queryFn: async () => {
      const [results, labs, classes, terms] = await Promise.all([
        getClassLabStudentResultsAction(classLabId),
        getClassLabsForClassAction(classId),
        getClassesForTermAction(termId),
        getTermsAction(),
      ]);
      const lab = labs.find((item) => item.id === classLabId);
      return {
        results,
        labCode: lab?.lab_code ?? "Lab",
        labDriveRootUrl: lab?.drive_root_url ?? "",
        className: classes.find((item) => item.id === classId)?.name ?? "Class",
        termName: terms.find((item) => item.id === termId)?.name ?? "Term",
      };
    },
    enabled: Boolean(termId && classId && classLabId),
  });
}

export function adminStudentDetailsQueryOptions(
  termId: string,
  classId: string,
  classLabId: string,
  classStudentId: string,
  hasAttempts: boolean
) {
  return queryOptions({
    queryKey: adminQueryKeys.studentDetails(termId, classId, classLabId, classStudentId),
    queryFn: async () => {
      const [submissions, resubmissions] = await Promise.all([
        hasAttempts
          ? getAdminStudentSubmissionsAction(classStudentId, classLabId)
          : Promise.resolve([]),
        getAdminStudentResubmissionsAction(classStudentId, classLabId),
      ]);
      return { submissions, resubmissions };
    },
  });
}

export function adminClassLabSubmissionsQueryOptions(
  termId: string,
  classId: string,
  classLabId: string
) {
  return queryOptions({
    queryKey: adminQueryKeys.classLabSubmissions(termId, classId, classLabId),
    queryFn: () => getAdminClassLabSubmissionsAction(classLabId),
  });
}

export function adminDashboardOverviewQueryOptions() {
  return queryOptions({
    queryKey: adminQueryKeys.dashboardOverview(),
    queryFn: getAdminDashboardStatsAction,
  });
}

export function adminDashboardResubmissionsQueryOptions(filters: AdminResubmissionFilters) {
  return queryOptions({
    queryKey: adminQueryKeys.dashboardResubmissions(filters),
    queryFn: () => getAdminResubmissionsAction(filters),
  });
}

export function adminDashboardAccessQueryOptions(filters: AdminAccessFilters) {
  return queryOptions({
    queryKey: adminQueryKeys.dashboardAccess(filters),
    queryFn: () => getAllowedEmailsAction(filters),
  });
}
