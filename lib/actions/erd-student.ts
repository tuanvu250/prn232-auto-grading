"use server";

import { getServerUser } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase";
import type {
  SessionSubmission,
  StudentGradingSessionOverview,
  SubmissionStatus,
} from "@/lib/types/erd";

async function requireStudentUser() {
  const user = await getServerUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function getCurrentClassStudentIdAction(): Promise<string | null> {
  const user = await requireStudentUser();
  if (!user.email || !user.className) return null;
  const { data: student, error: studentError } = await supabaseServer
    .from("students")
    .select("id")
    .eq("email", user.email.trim().toLowerCase())
    .maybeSingle();
  if (studentError) throw new Error(studentError.message);
  if (!student) return null;

  const { data, error } = await supabaseServer
    .from("class_students")
    .select("id, classes!inner(name, terms!inner(starts_on))")
    .eq("student_id", student.id)
    .eq("classes.name", user.className.trim().toUpperCase())
    .order("starts_on", { referencedTable: "classes.terms", ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.id ?? null;
}

export async function getStudentSessionOverviewAction(): Promise<StudentGradingSessionOverview[]> {
  const classStudentId = await getCurrentClassStudentIdAction();
  if (!classStudentId) return [];
  const { data: enrollment, error: enrollmentError } = await supabaseServer
    .from("class_students")
    .select("class_id")
    .eq("id", classStudentId)
    .single();
  if (enrollmentError) throw new Error(enrollmentError.message);

  const [sessionResult, submissionResult] = await Promise.all([
    supabaseServer
      .from("grading_sessions")
      .select("id, name, status, deadline, drive_root_url, labs(code, title)")
      .eq("class_id", enrollment.class_id)
      .order("created_at", { ascending: false }),
    supabaseServer
      .from("session_submissions")
      .select("grading_session_id, attempt_no, score, status")
      .eq("class_student_id", classStudentId)
      .order("attempt_no", { ascending: false }),
  ]);
  if (sessionResult.error) throw new Error(sessionResult.error.message);
  if (submissionResult.error) throw new Error(submissionResult.error.message);

  const attempts = new Map<string, typeof submissionResult.data>();
  for (const row of submissionResult.data ?? []) {
    const rows = attempts.get(row.grading_session_id) ?? [];
    rows.push(row);
    attempts.set(row.grading_session_id, rows);
  }

  return (sessionResult.data ?? []).map((session) => {
    const sessionAttempts = attempts.get(session.id) ?? [];
    const latest = sessionAttempts[0];
    const lab = Array.isArray(session.labs) ? session.labs[0] : session.labs;
    return {
      grading_session_id: session.id,
      session_name: session.name,
      session_status: session.status,
      lab_code: lab?.code ?? "",
      lab_title: lab?.title ?? null,
      deadline: session.deadline,
      drive_root_url: session.drive_root_url,
      attempt_count: sessionAttempts.length,
      latest_attempt_no: latest?.attempt_no ?? null,
      latest_score: latest?.score ?? null,
      latest_status: (latest?.status as SubmissionStatus | undefined) ?? null,
    };
  });
}

export async function getSessionAttemptsAction(sessionId: string): Promise<SessionSubmission[]> {
  const classStudentId = await getCurrentClassStudentIdAction();
  if (!classStudentId) return [];
  const { data, error } = await supabaseServer
    .from("session_submissions")
    .select("*")
    .eq("class_student_id", classStudentId)
    .eq("grading_session_id", sessionId)
    .order("attempt_no", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSubmissionDetailAction(
  submissionId: string
): Promise<SessionSubmission | null> {
  const classStudentId = await getCurrentClassStudentIdAction();
  if (!classStudentId) return null;
  const { data, error } = await supabaseServer
    .from("session_submissions")
    .select("*")
    .eq("id", submissionId)
    .eq("class_student_id", classStudentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getGradingSessionAccessAction(
  sessionId: string
): Promise<StudentGradingSessionOverview | null> {
  const sessions = await getStudentSessionOverviewAction();
  return sessions.find((session) => session.grading_session_id === sessionId) ?? null;
}
