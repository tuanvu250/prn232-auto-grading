import type { QueryClient } from "@tanstack/react-query";

import { adminQueryKeys } from "@/lib/queries/admin";
import { studentQueryKeys } from "@/lib/queries/student";

export async function invalidateAdminRootCaches(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: studentQueryKeys.all }),
  ]);
}

export async function invalidateAdminTermCaches(queryClient: QueryClient, termId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.classes(termId) }),
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard() }),
    queryClient.invalidateQueries({ queryKey: studentQueryKeys.all }),
  ]);
}

export async function invalidateAdminClassCaches(
  queryClient: QueryClient,
  termId: string,
  classId: string
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.classWorkspace(termId, classId) }),
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard() }),
    queryClient.invalidateQueries({ queryKey: studentQueryKeys.all }),
  ]);
}
