import { NextResponse } from "next/server";

import { ROLE_ADMIN, ROLE_STUDENT } from "@/lib/types/roles";
import { isAdminEmail } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase";

interface GoogleLoginRequest {
  email?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GoogleLoginRequest;
    const email = body.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    if (isAdminEmail(email)) {
      return NextResponse.json({
        success: true,
        data: {
          role: ROLE_ADMIN,
          studentId: undefined,
          className: undefined,
        },
      });
    }

    const { data, error } = await supabaseServer
      .rpc("check_email_whitelist", { email_to_check: email })
      .maybeSingle<{ student_id: string; class_name: string }>();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Email is not allowed" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        role: ROLE_STUDENT,
        studentId: data.student_id,
        className: data.class_name,
      },
    });
  } catch (err) {
    console.error("Google login role resolution failed:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
