"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppDispatch } from "@/lib/redux/hooks";
import { logout } from "@/lib/redux/slices/authSlice";

export function useAuthSyncAcrossTabs() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleLogout = () => {
      queryClient.clear();
      dispatch(logout());
      const path = window.location.pathname;
      const isAuthPage = ["/login", "/register", "/reset-password"].some(
        (r) => path === r || path.startsWith(`${r}/`)
      );
      if (!isAuthPage) {
        window.location.href = "/login";
      }
    };
    window.addEventListener("logout", handleLogout);
    return () => window.removeEventListener("logout", handleLogout);
  }, [dispatch, queryClient]);
}
