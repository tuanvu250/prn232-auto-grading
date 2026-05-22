import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtDecode } from "jwt-decode";
import {
  AUTH_ROUTES,
  PUBLIC_ROUTES,
  ROLE_ADMIN,
  ROLE_STUDENT,
  ROLE_TEACHER,
  ROUTE_MAP,
  getPrimaryRole,
  normalizeRoles,
} from "@/lib/types/roles";

function getUserRoles(token: string | undefined): string[] {
  if (!token) return [];
  try {
    const decoded = jwtDecode(token) as { role?: string | string[]; exp?: number } | null;
    if (decoded?.exp && decoded.exp < Math.floor(Date.now() / 1000)) return [];
    if (!decoded?.role) return [];
    const roles = Array.isArray(decoded.role) ? decoded.role : [decoded.role];
    return normalizeRoles(roles);
  } catch {
    return [];
  }
}

function hasRole(roles: string[], target: string) {
  return roles.includes(target);
}

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("authToken")?.value;
  const userRoles = getUserRoles(token);
  const primaryRole = getPrimaryRole(userRoles);

  if (pathname.endsWith(".xml") || pathname.endsWith(".json")) {
    return NextResponse.next();
  }

  if (!token || userRoles.length === 0) {
    if (isPublicRoute(pathname)) return NextResponse.next();
    const res = NextResponse.redirect(new URL(ROUTE_MAP.login, request.url));
    if (token) res.cookies.delete("authToken");
    return res;
  }

  if (isAuthRoute(pathname)) {
    if (primaryRole === ROLE_ADMIN)
      return NextResponse.redirect(new URL(ROUTE_MAP.adminDashboard, request.url));
    if (primaryRole === ROLE_TEACHER)
      return NextResponse.redirect(new URL(ROUTE_MAP.teacherDashboard, request.url));
    if (primaryRole === ROLE_STUDENT)
      return NextResponse.redirect(new URL(ROUTE_MAP.studentDashboard, request.url));
    return NextResponse.redirect(new URL("/", request.url));
  }

  const isAdminRoute = pathname.startsWith("/admin/");
  const isTeacherRoute = pathname.startsWith("/teacher/");
  const isStudentRoute = pathname.startsWith("/student/");

  if (hasRole(userRoles, ROLE_ADMIN)) {
    if (isAdminRoute) return NextResponse.next();
    if (isPublicRoute(pathname)) return NextResponse.next();
    if (!isTeacherRoute && !isStudentRoute && !isAdminRoute) {
      return NextResponse.redirect(new URL(ROUTE_MAP.adminDashboard, request.url));
    }
  }

  if (hasRole(userRoles, ROLE_TEACHER)) {
    if (isTeacherRoute || isPublicRoute(pathname)) return NextResponse.next();
    if (isAdminRoute && !hasRole(userRoles, ROLE_ADMIN))
      return NextResponse.redirect(new URL(ROUTE_MAP.teacherDashboard, request.url));
    return NextResponse.next();
  }

  if (hasRole(userRoles, ROLE_STUDENT)) {
    if (isAdminRoute || isTeacherRoute)
      return NextResponse.redirect(new URL(ROUTE_MAP.studentDashboard, request.url));
    if (isStudentRoute || isPublicRoute(pathname)) return NextResponse.next();
    return NextResponse.next();
  }

  const res = NextResponse.redirect(new URL(ROUTE_MAP.login, request.url));
  res.cookies.delete("authToken");
  return res;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webm|mp4|xml|glb)$).*)",
  ],
};
