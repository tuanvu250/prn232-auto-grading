"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleLogin, useGoogleOneTapLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMockJWT, setAuthCookie } from "@/lib/utils/auth";
import { ROLE_STUDENT, ROUTE_MAP } from "@/lib/types/roles";
import { supabase } from "@/lib/supabase";

interface GoogleUserPayload {
  email: string;
  name: string;
  picture?: string;
}

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Xử lý sau khi đăng nhập thành công
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
      toast.success("Đăng nhập thành công bằng tài khoản Google!");
      
      // Tất cả tài khoản Google đăng nhập thành công đều được gán ROLE_STUDENT
      router.push(ROUTE_MAP.studentDashboard);
    } catch {
      toast.error("Đã xảy ra lỗi trong quá trình xử lý đăng nhập.");
    }
  };

  // Hàm xử lý và giải mã Credential của Google (dùng chung cho cả One Tap và Button)
  const handleGoogleCredential = async (credential?: string) => {
    if (!credential) {
      toast.error("Không nhận được thông tin xác thực từ Google.");
      return;
    }

    setLoading(true);
    try {
      const decoded = jwtDecode<GoogleUserPayload>(credential);
      
      if (!decoded.email) {
        toast.error("Không thể lấy email từ tài khoản Google.");
        setLoading(false);
        return;
      }

      let studentId = "";
      let className = "";

      // 1. Kiểm tra email trên whitelist AllowedEmails của Supabase
      try {
        const { data: whitelistData, error: whitelistError } = await supabase
          .rpc("check_email_whitelist", { email_to_check: decoded.email.toLowerCase().trim() })
          .maybeSingle<{ student_id: string; class_name: string }>();

        if (whitelistError) {
          console.error("Lỗi truy vấn whitelist Supabase:", whitelistError);
          toast.error("Không thể xác thực quyền truy cập. Vui lòng thử lại sau.");
          setLoading(false);
          return;
        }

        if (!whitelistData) {
          toast.error("Email của bạn không nằm trong danh sách được cấp phép truy cập.");
          setLoading(false);
          return;
        }

        studentId = whitelistData.student_id;
        className = whitelistData.class_name;
      } catch (dbErr) {
        console.error("Lỗi kết nối Supabase:", dbErr);
        toast.error("Lỗi kết nối cơ sở dữ liệu. Vui lòng thử lại sau.");
        setLoading(false);
        return;
      }

      handleLoginSuccess({
        email: decoded.email,
        name: decoded.name || decoded.email.split("@")[0],
        picture: decoded.picture,
        role: ROLE_STUDENT,
        studentId: studentId || undefined,
        className: className || undefined,
      });
    } catch (err) {
      console.error("Lỗi giải mã token Google:", err);
      toast.error("Đã xảy ra lỗi khi đọc thông tin từ Google.");
    } finally {
      setLoading(false);
    }
  };

  // Kích hoạt Google One Tap khi render trang chủ
  useGoogleOneTapLogin({
    onSuccess: (credentialResponse) => {
      handleGoogleCredential(credentialResponse.credential);
    },
    onError: () => {
      console.warn("Google One Tap: Không thể tự động hiển thị hoặc bị người dùng đóng.");
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
            Hệ thống chấm điểm và chẩn đoán bài tập Lab PRN232 (.NET/C#)
          </p>
        </div>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Đăng nhập</CardTitle>
            <CardDescription className="text-center">
              Sử dụng tài khoản Google để truy cập bảng điểm
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            {/* Nút đăng nhập bằng Google mặc định từ thư viện */}
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
                  toast.error("Đăng nhập bằng Google thất bại.");
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
          <p>© 2026 PRN232 Grading System. Phát triển cho mục đích giáo dục.</p>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 mt-2 hover:text-foreground"
          >
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            GitHub Repository
          </a>
        </div>
      </div>
    </main>
  );
}
