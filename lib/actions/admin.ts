"use server";

import { getServerUser, userIsAdmin } from "@/lib/server/auth";
import { createPaginationMeta } from "@/lib/server/pagination";
import { supabaseServer } from "@/lib/server/supabase";

async function requireAdmin() {
  const user = await getServerUser();
  if (!user || !userIsAdmin(user)) throw new Error("Forbidden");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Internal Server Error";
}

function normalizeEmail(email?: string) {
  return email?.trim().toLowerCase() || "";
}

export async function getAllowedEmailsAction(params: {
  q?: string;
  className?: string;
  page: number;
  pageSize: number;
}) {
  try {
    await requireAdmin();
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const from = (page - 1) * pageSize;
    const className = params.className?.trim();
    const query = params.q?.trim();
    const relation =
      className && className !== "all"
        ? "class_students!inner(classes!inner(name))"
        : "class_students(classes(name))";
    let request = supabaseServer
      .from("students")
      .select(`email, student_code, name, ${relation}`, { count: "exact" })
      .order("student_code")
      .range(from, from + pageSize - 1);
    if (query)
      request = request.or(
        `email.ilike.%${query}%,student_code.ilike.%${query}%,name.ilike.%${query}%`
      );
    if (className && className !== "all")
      request = request.eq("class_students.classes.name", className);
    const { data, count, error } = await request;
    if (error) return { success: false, error: error.message };

    type StudentAccessJoin = {
      email: string;
      student_code: string;
      name: string | null;
      class_students: Array<{ classes: { name: string } | null }>;
    };
    const rows = ((data ?? []) as unknown as StudentAccessJoin[]).map((student) => ({
      email: student.email,
      student_id: student.student_code,
      class_name: student.class_students?.[0]?.classes?.name ?? "",
      name: student.name ?? "",
    }));
    const { data: classes } = await supabaseServer.from("classes").select("name");
    const classNames = Array.from(new Set((classes ?? []).map((row) => row.name))).sort();
    return {
      success: true,
      data: rows,
      pagination: createPaginationMeta(page, pageSize, count || 0),
      summary: { total: count || 0, classes: classNames.length, classNames },
    };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}

async function resolveClassId(className: string) {
  const { data: existing, error: existingError } = await supabaseServer
    .from("classes")
    .select("id")
    .eq("name", className)
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing.id;
  const { data: term, error: termError } = await supabaseServer
    .from("terms")
    .select("id")
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (termError) throw new Error(termError.message);
  if (!term) throw new Error("Create a term before adding a class");
  const { data, error } = await supabaseServer
    .from("classes")
    .insert({ term_id: term.id, name: className })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function saveAllowedEmailAction(payload: {
  email: string;
  studentId: string;
  className: string;
  name?: string;
  isEdit: boolean;
}) {
  try {
    await requireAdmin();
    const email = normalizeEmail(payload.email);
    const studentCode = payload.studentId.trim().toUpperCase();
    const className = payload.className.trim().toUpperCase();
    const name = payload.name?.trim() || "";
    if (!email || !studentCode || !className)
      return { success: false, error: "Email, student ID and class are required" };
    const classId = await resolveClassId(className);
    const { data: student, error: studentError } = await supabaseServer
      .from("students")
      .upsert({ email, student_code: studentCode, name: name || null }, { onConflict: "email" })
      .select("id")
      .single();
    if (studentError) return { success: false, error: studentError.message };
    if (payload.isEdit)
      await supabaseServer.from("class_students").delete().eq("student_id", student.id);
    const { error: linkError } = await supabaseServer
      .from("class_students")
      .upsert(
        { class_id: classId, student_id: student.id },
        { onConflict: "class_id, student_id" }
      );
    if (linkError) return { success: false, error: linkError.message };
    return { success: true, data: { email, student_id: studentCode, class_name: className, name } };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function deleteAllowedEmailAction(email: string) {
  try {
    await requireAdmin();
    const normalized = normalizeEmail(email);
    if (!normalized) return { success: false, error: "Email is required" };
    const { error } = await supabaseServer.from("students").delete().eq("email", normalized);
    return error ? { success: false, error: error.message } : { success: true };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function importAllowedEmailsAction(
  rows: Array<{ email: string; studentId: string; className: string; name?: string }>
) {
  try {
    await requireAdmin();
    let imported = 0;
    for (const row of rows) {
      const result = await saveAllowedEmailAction({ ...row, isEdit: false });
      if (result.success) imported++;
    }
    return { success: true, imported, skipped: rows.length - imported, duplicates: 0 };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function getAdminDashboardStatsAction() {
  try {
    await requireAdmin();
    const [students, classes, sessions, openSessions, submissions] = await Promise.all([
      supabaseServer.from("students").select("id", { count: "exact", head: true }),
      supabaseServer.from("classes").select("id", { count: "exact", head: true }),
      supabaseServer.from("grading_sessions").select("id", { count: "exact", head: true }),
      supabaseServer
        .from("grading_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabaseServer.from("session_submissions").select("id", { count: "exact", head: true }),
    ]);
    const countError =
      students.error || classes.error || sessions.error || openSessions.error || submissions.error;
    if (countError) return { success: false, error: countError.message };

    const { data: recentRows, error: recentError } = await supabaseServer
      .from("session_submissions")
      .select(
        "score, status, graded_at, submitted_at, class_students!inner(students!inner(student_code, name), classes!inner(name)), grading_sessions!inner(name, labs!inner(code))"
      )
      .order("graded_at", { ascending: false, nullsFirst: false })
      .limit(8);
    if (recentError) return { success: false, error: recentError.message };

    type RecentJoin = {
      score: number | null;
      status: string;
      graded_at: string | null;
      submitted_at: string;
      class_students: {
        students: { student_code: string; name: string | null };
        classes: { name: string };
      };
      grading_sessions: { name: string; labs: { code: string } };
    };
    const recentSubmissions = ((recentRows ?? []) as unknown as RecentJoin[]).map((row) => ({
      student_id: row.class_students.students.student_code,
      student_name: row.class_students.students.name ?? "Unknown student",
      lab_id: row.grading_sessions.labs.code,
      session_name: row.grading_sessions.name,
      class_name: row.class_students.classes.name,
      score: row.score,
      status: row.status,
      updated_at: row.graded_at ?? row.submitted_at,
    }));

    return {
      success: true,
      data: {
        metrics: {
          totalStudents: students.count || 0,
          totalClasses: classes.count || 0,
          totalSessions: sessions.count || 0,
          openSessions: openSessions.count || 0,
          totalSubmissions: submissions.count || 0,
        },
        recentSubmissions,
      },
    };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}
