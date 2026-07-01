"use server";

import { ROLE_ADMIN, ROLE_STUDENT } from "@/lib/types/roles";
import { isAdminEmail } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase";

export async function googleLoginAction(email: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail) {
      return { success: false, error: "Email is required" };
    }

    if (isAdminEmail(normalizedEmail)) {
      return {
        success: true,
        data: {
          role: ROLE_ADMIN,
          studentId: undefined,
          className: undefined,
        },
      };
    }

    const { data, error } = await supabaseServer
      .rpc("check_email_whitelist", { email_to_check: normalizedEmail })
      .maybeSingle<{ student_id: string; class_name: string }>();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Email is not allowed" };
    }

    return {
      success: true,
      data: {
        role: ROLE_STUDENT,
        studentId: data.student_id,
        className: data.class_name,
      },
    };
  } catch (err) {
    console.error("Google login role resolution failed:", err);
    return { success: false, error: "Internal Server Error" };
  }
}
