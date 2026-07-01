"use client";

import { ReactNode } from "react";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { ReduxProvider } from "./reduxProvider";
import { QueryProvider } from "./queryProvider";
import { useAuthSyncAcrossTabs } from "@/hooks/useAuthSyncAcrossTabs";
import { Toaster } from "@/components/ui/sonner";

function AuthSyncProvider({ children }: { children: ReactNode }) {
  useAuthSyncAcrossTabs();
  return <>{children}</>;
}

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ReduxProvider>
      <QueryProvider>
        <GoogleOAuthProvider clientId={googleClientId}>
          <AuthSyncProvider>
            {children}
            <Toaster position="bottom-center" richColors closeButton />
          </AuthSyncProvider>
        </GoogleOAuthProvider>
      </QueryProvider>
    </ReduxProvider>
  );
}


