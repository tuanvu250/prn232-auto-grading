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

export async function getStudentMissingLabsAction() {
  try {
    const user = await getServerUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const studentId = user.studentId;
    const className = user.className;

    if (!studentId) {
      return { success: false, error: "Student ID not found in token" };
    }

    if (!className) {
      return { success: true, data: [] };
    }

    const { data: classSubmissions, error: classError } = await supabaseServer
      .from("submissions")
      .select("lab_id")
      .eq("class_name", className);

    if (classError) {
      return { success: false, error: classError.message };
    }

    const { data: studentSubmissions, error: studentError } = await supabaseServer
      .from("submissions")
      .select("lab_id")
      .eq("student_id", studentId);

    if (studentError) {
      return { success: false, error: studentError.message };
    }

    const classLabIds = new Set((classSubmissions || []).map((row) => row.lab_id).filter(Boolean));
    const studentLabIds = new Set(
      (studentSubmissions || []).map((row) => row.lab_id).filter(Boolean)
    );

    const missingLabIds = Array.from(classLabIds)
      .filter((labId) => !studentLabIds.has(labId))
      .sort((a, b) => a.localeCompare(b));

    return { success: true, data: missingLabIds };
  } catch (err: unknown) {
    console.error("Error fetching missing labs from Supabase:", err);
    return { success: false, error: "Internal Server Error" };
  }
}
