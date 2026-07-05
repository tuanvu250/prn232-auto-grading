"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { toast } from "sonner";
import {
  GraduationCap,
  KeyRound,
  LogOut,
  UploadCloud,
  User as UserIcon,
  Menu,
  X,
  Users,
  LayoutDashboard,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROLE_ADMIN } from "@/lib/types/roles";
import { removeAuthCookie, UserPayload } from "@/lib/utils/auth";

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserPayload | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentView = searchParams.get("view") || "overview";

  useEffect(() => {
    const token = Cookies.get("authToken");
    if (!token) {
      router.push("/");
      return;
    }

    try {
      const decoded = jwtDecode<UserPayload>(token);
      if (decoded.role !== ROLE_ADMIN) {
        router.push("/student/dashboard");
        return;
      }
      setUser(decoded);
    } catch {
      toast.error("Invalid session. Please sign in again.");
      removeAuthCookie();
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.picture]);

  const handleLogout = () => {
    removeAuthCookie();
    toast.success("Signed out.");
    router.push("/");
  };

  const isOverviewActive =
    pathname === "/admin/dashboard" && currentView === "overview";
  const isResubmissionsActive =
    pathname === "/admin/dashboard" && currentView === "resubmissions";
  const isStudentAccessActive =
    pathname === "/admin/dashboard" && currentView === "studentAccess";
  const isTermsActive = pathname.startsWith("/admin/terms");

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold tracking-tight">PRN232 Admin</p>
          <p className="text-[10px] text-muted-foreground">Control console</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 p-3">
        <Link
          href="/admin/dashboard?view=overview"
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isOverviewActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          Overview
        </Link>
        <Link
          href="/admin/dashboard?view=resubmissions"
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isResubmissionsActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <UploadCloud className="h-4 w-4" />
          Resubmit Requests
        </Link>
        <Link
          href="/admin/dashboard?view=studentAccess"
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isStudentAccessActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          Students
        </Link>
        <Link
          href="/admin/terms"
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isTermsActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          Submissions
        </Link>
      </nav>

      {/* User profile / Logout */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          {user.picture && !avatarError ? (
            <img
              src={user.picture}
              alt={user.name}
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="h-9 w-9 rounded-full border border-border"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserIcon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{user.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Sign out"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground lg:grid lg:grid-cols-[280px_1fr]">
      {/* Sidebar for Desktop */}
      <aside className="hidden border-r border-border bg-card lg:h-screen lg:block">
        {sidebarContent}
      </aside>

      {/* Header for Mobile */}
      <div className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            className="h-9 w-9"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-bold">PRN232 Admin</span>
        </div>
        <div className="flex items-center gap-2">
          {user.picture && !avatarError ? (
            <img
              src={user.picture}
              alt={user.name}
              className="h-7 w-7 rounded-full border border-border"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserIcon className="h-3.5 w-3.5" />
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8" title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Drawer / Overlay Sidebar for Mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex w-[280px] flex-col border-r border-border bg-card animate-in slide-in-from-left duration-200">
            <div className="absolute right-4 top-3.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="h-9 w-9"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="min-w-0 bg-muted/5 overflow-y-auto h-[calc(100vh-64px)] lg:h-screen">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
