/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  loginAsync,
  logoutAsync,
  selectAuth,
  selectUser,
  setupAutoRefresh,
} from "@/lib/redux/slices/authSlice";
import {
  ROLE_ADMIN,
  ROLE_STUDENT,
  ROLE_TEACHER,
  ROUTE_MAP,
  normalizeRoles,
} from "@/lib/types/roles";

export function useAuth() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectUser);

  const roles = normalizeRoles(user?.role ?? []);
  const isAdmin = roles.includes(ROLE_ADMIN);
  const isTeacher = roles.includes(ROLE_TEACHER);
  const isStudent = roles.includes(ROLE_STUDENT);

  const redirectByRoles = (roleList: string[]) => {
    const r = normalizeRoles(roleList);
    if (r.includes(ROLE_ADMIN)) router.push(ROUTE_MAP.adminDashboard);
    else if (r.includes(ROLE_TEACHER)) router.push(ROUTE_MAP.teacherDashboard);
    else router.push(ROUTE_MAP.studentDashboard);
  };

  const login = async (credentials: { email: string; password: string }) => {
    try {
      const result = await dispatch(loginAsync(credentials)).unwrap();
      if (result.token) setupAutoRefresh(result.token, dispatch as any);
      toast.success("Đăng nhập thành công");
      redirectByRoles(result.user?.role ?? []);
      return result;
    } catch (error: any) {
      toast.error(error || "Đăng nhập thất bại");
      throw error;
    }
  };

  const logout = async () => {
    try {
      await dispatch(logoutAsync()).unwrap();
      toast.success("Đăng xuất thành công");
      router.push(ROUTE_MAP.login);
    } catch {
      dispatch(logoutAsync());
      router.push(ROUTE_MAP.login);
    }
  };

  return {
    ...auth,
    user,
    isAdmin,
    isTeacher,
    isStudent,
    login,
    logout,
  };
}
