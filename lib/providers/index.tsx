"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { ReduxProvider } from "./reduxProvider";
import { QueryProvider } from "./queryProvider";
import { useAuthSyncAcrossTabs } from "@/hooks/useAuthSyncAcrossTabs";
import { Toaster } from "@/components/ui/sonner";

function AuthSyncProvider({ children }: { children: ReactNode }) {
  useAuthSyncAcrossTabs();
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ReduxProvider>
      <QueryProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthSyncProvider>
            {children}
            <Toaster position="bottom-center" richColors closeButton />
          </AuthSyncProvider>
        </ThemeProvider>
      </QueryProvider>
    </ReduxProvider>
  );
}
