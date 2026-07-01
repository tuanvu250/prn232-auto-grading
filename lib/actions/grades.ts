"use server";

import { getServerUser } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase";

export async function getStudentGradesAction() {
  try {
    const user = await getServerUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const studentId = user.studentId;

    if (!studentId) {
      return { success: false, error: "Student ID not found in token" };
    }

    // Query submissions for the authenticated student ID
    const { data, error } = await supabaseServer
      .from("submissions")
      .select("*")
      .eq("student_id", studentId)
      .order("lab_id", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: unknown) {
    console.error("Error fetching grades from Supabase:", err);
    return { success: false, error: "Internal Server Error" };
  }
}
