export const ROLE_ADMIN = "ROLE_ADMIN";
export const ROLE_TEACHER = "ROLE_TEACHER";
export const ROLE_INSTRUCTOR = "ROLE_INSTRUCTOR";
export const ROLE_STUDENT = "ROLE_STUDENT";

export type UserRole = typeof ROLE_ADMIN | typeof ROLE_TEACHER | typeof ROLE_STUDENT;

export const PUBLIC_ROUTES = ["/", "/landing", "/login", "/register", "/reset-password"] as const;

export const AUTH_ROUTES = ["/login", "/register", "/reset-password"] as const;

export const ROUTE_MAP = {
  adminDashboard: "/admin/dashboard",
  teacherDashboard: "/teacher/dashboard",
  studentDashboard: "/student/dashboard",
  login: "/login",
} as const;

export function normalizeRoles(roles: string[]): string[] {
  return roles.map((r) => (r === ROLE_INSTRUCTOR ? ROLE_TEACHER : r));
}

export function getPrimaryRole(roles: string[]): string | null {
  const normalized = normalizeRoles(roles);
  if (normalized.includes(ROLE_ADMIN)) return ROLE_ADMIN;
  if (normalized.includes(ROLE_TEACHER)) return ROLE_TEACHER;
  if (normalized.includes(ROLE_STUDENT)) return ROLE_STUDENT;
  return null;
}
