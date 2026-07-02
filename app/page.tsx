"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleLogin, useGoogleOneTapLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMockJWT, setAuthCookie } from "@/lib/utils/auth";
import { ROLE_ADMIN, ROUTE_MAP } from "@/lib/types/roles";
import { googleLoginAction } from "@/lib/actions/auth";

interface GoogleUserPayload {
  email: string;
  name: string;
  picture?: string;
}

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Handle a successful sign-in.
  const handleLoginSuccess = (payload: {
    email: string;
    name: string;
    picture?: string;
    role: string;
    studentId?: string;
    className?: string;
  }) => {
    try {
      const token = generateMockJWT(payload);
      setAuthCookie(token);
      toast.success("Signed in with Google.");
      
      router.push(payload.role === ROLE_ADMIN ? ROUTE_MAP.adminDashboard : ROUTE_MAP.studentDashboard);
    } catch {
      toast.error("Unable to complete sign-in.");
    }
  };

  // Decode and process Google credentials from One Tap and the button.
  const handleGoogleCredential = async (credential?: string) => {
    if (!credential) {
      toast.error("Google did not return a credential.");
      return;
    }

    setLoading(true);
    try {
      const decoded = jwtDecode<GoogleUserPayload>(credential);
      
      if (!decoded.email) {
        toast.error("Unable to read the email from your Google account.");
        setLoading(false);
        return;
      }

      const roleJson = await googleLoginAction(decoded.email);

      if (!roleJson.success || !roleJson.data) {
        console.error("Access validation failed:", !roleJson.success ? roleJson.error : "No data returned");
        toast.error(
          !roleJson.success && roleJson.error === "Email is not allowed"
            ? "Your email is not allowed to access this system."
            : "Unable to validate access. Please try again."
        );
        setLoading(false);
        return;
      }

      handleLoginSuccess({
        email: decoded.email,
        name: decoded.name || decoded.email.split("@")[0],
        picture: decoded.picture,
        role: roleJson.data.role,
        studentId: roleJson.data.studentId || undefined,
        className: roleJson.data.className || undefined,
      });
    } catch (err) {
      console.error("Failed to decode Google token:", err);
      toast.error("Unable to read your Google profile.");
    } finally {
      setLoading(false);
    }
  };

  // Enable Google One Tap on the sign-in page.
  useGoogleOneTapLogin({
    onSuccess: (credentialResponse) => {
      handleGoogleCredential(credentialResponse.credential);
    },
    onError: () => {
      console.warn("Google One Tap could not be shown or was dismissed.");
    },
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 transition-colors duration-200">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="mt-4 font-sans text-3xl font-bold tracking-tight text-foreground">
            PRN232 Auto Grading
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-sans">
            PRN232 (.NET/C#) lab grading and diagnostics portal
          </p>
        </div>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Use your Google Education account to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            {/* Default Google sign-in button from the library */}
            <div className="w-full flex justify-center py-2 relative">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/50">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                </div>
              )}
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  handleGoogleCredential(credentialResponse.credential);
                }}
                onError={() => {
                  toast.error("Google sign-in failed.");
                }}
                useOneTap
                theme="outline"
                size="large"
                width="320"
              />
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground font-sans">
          <p>© 2026 PRN232 Grading System. Built for educational use.</p>
        </div>
      </div>
    </main>
  );
}
