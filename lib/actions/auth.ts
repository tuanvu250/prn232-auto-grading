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

    const { data: student, error: studentError } = await supabaseServer
      .from("students")
      .select("student_code, class_students(classes(name))")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (studentError) {
      return { success: false, error: studentError.message };
    }

    if (!student) {
      return { success: false, error: "Email is not allowed" };
    }

    const classStudents = student.class_students as any[];
    const className = classStudents?.[0]?.classes?.name || "";

    return {
      success: true,
      data: {
        role: ROLE_STUDENT,
        studentId: student.student_code,
        className,
      },
    };
  } catch (err) {
    console.error("Google login role resolution failed:", err);
    return { success: false, error: "Internal Server Error" };
  }
}
