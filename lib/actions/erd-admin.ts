"use server";

import { getServerUser, userIsAdmin } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase";
import type {
  ClassRow,
  ClassGradeMatrixResult,
  ClassStudentRosterRow,
  GradingSession,
  GradingSessionStatus,
  GradingSessionStudentResult,
  SessionSubmission,
  SubmissionStatus,
  Term,
} from "@/lib/types/erd";
import {
  normalizeOptionalUrl,
  normalizeSessionDeadline,
  uniqueIds,
} from "@/lib/utils/grading-session";

async function requireAdmin() {
  const user = await getServerUser();
  if (!user || !userIsAdmin(user)) throw new Error("Forbidden: admin access required");
}

export async function getTermsAction(): Promise<Term[]> {
  await requireAdmin();
  const { data, error } = await supabaseServer
    .from("terms")
    .select("id, name, starts_on, ends_on")
    .order("starts_on", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClassesForTermAction(termId: string): Promise<ClassRow[]> {
  await requireAdmin();
  const { data, error } = await supabaseServer
    .from("classes")
    .select("id, term_id, name")
    .eq("term_id", termId)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getGradingSessionsForClassAction(classId: string): Promise<GradingSession[]> {
  await requireAdmin();
  const { data, error } = await supabaseServer
    .from("grading_sessions")
    .select(
      "id, class_id, lab_id, name, deadline, drive_root_url, status, created_at, labs(code, title)"
    )
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  type JoinRow = Omit<GradingSession, "lab_code" | "lab_title"> & {
    labs: { code: string; title: string | null } | null;
  };

  return ((data ?? []) as unknown as JoinRow[]).map(({ labs, ...session }) => ({
    ...session,
    lab_code: labs?.code ?? "",
    lab_title: labs?.title ?? null,
  }));
}

export async function getClassStudentsForClassAction(
  classId: string
): Promise<ClassStudentRosterRow[]> {
  await requireAdmin();
  const { data, error } = await supabaseServer
    .from("class_students")
    .select("id, student_id, students!inner(id, email, student_code, name)")
    .eq("class_id", classId)
    .order("student_code", { referencedTable: "students", ascending: true });
  if (error) throw new Error(error.message);

  type JoinRow = {
    id: string;
    student_id: string;
    students: { id: string; email: string; student_code: string; name: string | null } | null;
  };

  return ((data ?? []) as unknown as JoinRow[]).map((row) => ({
    class_student_id: row.id,
    student_id: row.student_id || row.students?.id || "",
    student_code: row.students?.student_code ?? "",
    student_name: row.students?.name ?? null,
    student_email: row.students?.email ?? "",
  }));
}

export async function getLabCatalogAction() {
  await requireAdmin();
  const { data, error } = await supabaseServer.from("labs").select("id, code, title").order("code");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createLabAction(code: string, title: string | null) {
  await requireAdmin();
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) throw new Error("Lab code is required");
  const { data, error } = await supabaseServer
    .from("labs")
    .insert({ code: normalizedCode, title: title?.trim() || null })
    .select("id, code, title")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface CreateGradingSessionsInput {
  termId: string;
  targets: Array<{ classId: string; driveRootUrl: string }>;
  labId: string;
  name: string;
  deadline: string | null;
}

export type CreateGradingSessionsResult =
  | { success: true; created: number; sessions: Array<{ id: string; class_id: string }> }
  | { success: false; message: string };

function getCreateGradingSessionsErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Forbidden")) {
    return "You need admin access to create grading sessions.";
  }
  if (message.includes("Term, lab, session name")) {
    return "Select a lab, enter a session name, and choose at least one class.";
  }
  if (message.includes("Deadline")) {
    return message;
  }
  if (message.includes("Drive root")) {
    return message;
  }
  if (message.includes("Every selected class")) {
    return message;
  }
  if (message.includes("An open session already exists")) {
    return message;
  }
  if (message.includes("grading_sessions_one_open_per_class_lab_idx")) {
    return "An open session already exists for this lab in at least one selected class. Close the current session before creating the next one.";
  }

  return "Unable to create grading sessions. Please try again or check the server logs.";
}

export async function createGradingSessionsAction(
  input: CreateGradingSessionsInput
): Promise<CreateGradingSessionsResult> {
  try {
    return await createGradingSessions(input);
  } catch (error) {
    console.error("createGradingSessionsAction failed", error);
    return { success: false, message: getCreateGradingSessionsErrorMessage(error) };
  }
}

async function createGradingSessions(
  input: CreateGradingSessionsInput
): Promise<CreateGradingSessionsResult> {
  await requireAdmin();
  const targetsByClass = new Map(
    input.targets.map((target) => [target.classId.trim(), target.driveRootUrl])
  );
  const classIds = uniqueIds([...targetsByClass.keys()]);
  const name = input.name.trim();
  if (!input.termId || !input.labId || !name || classIds.length === 0) {
    throw new Error("Term, lab, session name and at least one class are required");
  }

  const deadline = normalizeSessionDeadline(input.deadline);
  const targets = classIds.map((classId) => ({
    classId,
    driveRootUrl: normalizeOptionalUrl(targetsByClass.get(classId)),
  }));
  const { data: classes, error: classesError } = await supabaseServer
    .from("classes")
    .select("id")
    .eq("term_id", input.termId)
    .in("id", classIds);
  if (classesError) throw new Error(classesError.message);
  if ((classes ?? []).length !== classIds.length) {
    throw new Error("Every selected class must belong to the current term");
  }

  const { data: conflicts, error: conflictError } = await supabaseServer
    .from("grading_sessions")
    .select("class_id, classes(name)")
    .eq("lab_id", input.labId)
    .eq("status", "open")
    .in("class_id", classIds);
  if (conflictError) throw new Error(conflictError.message);
  if (conflicts?.length) {
    const names = conflicts
      .map((row) => {
        const joined = Array.isArray(row.classes) ? row.classes[0] : row.classes;
        return joined?.name ?? row.class_id;
      })
      .join(", ");
    throw new Error(`An open session already exists for this lab in: ${names}`);
  }

  const { data, error } = await supabaseServer
    .from("grading_sessions")
    .insert(
      targets.map((target) => ({
        class_id: target.classId,
        lab_id: input.labId,
        name,
        deadline,
        drive_root_url: target.driveRootUrl,
        status: "open" as const,
      }))
    )
    .select("id, class_id");
  if (error) throw new Error(error.message);
  return { success: true, created: data?.length ?? 0, sessions: data ?? [] };
}

export async function updateGradingSessionAction(
  sessionId: string,
  input: {
    name: string;
    deadline: string | null;
    driveRootUrl: string | null;
    status: GradingSessionStatus;
  }
) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Session name is required");
  const deadline = input.deadline
    ? normalizeSessionDeadline(input.deadline, input.status === "closed")
    : null;
  const { data, error } = await supabaseServer
    .from("grading_sessions")
    .update({
      name,
      deadline,
      drive_root_url: normalizeOptionalUrl(input.driveRootUrl),
      status: input.status,
    })
    .eq("id", sessionId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteGradingSessionAction(sessionId: string) {
  await requireAdmin();
  const { count, error: countError } = await supabaseServer
    .from("session_submissions")
    .select("id", { count: "exact", head: true })
    .eq("grading_session_id", sessionId);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) throw new Error("Close sessions with submissions instead of deleting them");

  const { error } = await supabaseServer.from("grading_sessions").delete().eq("id", sessionId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getGradingSessionStudentResultsAction(
  sessionId: string
): Promise<GradingSessionStudentResult[]> {
  await requireAdmin();
  const { data: session, error: sessionError } = await supabaseServer
    .from("grading_sessions")
    .select("class_id")
    .eq("id", sessionId)
    .single();
  if (sessionError) throw new Error(sessionError.message);

  const [roster, submissionResult] = await Promise.all([
    getClassStudentsForClassAction(session.class_id),
    supabaseServer
      .from("session_submissions")
      .select("class_student_id, attempt_no, score, status")
      .eq("grading_session_id", sessionId)
      .order("attempt_no", { ascending: false }),
  ]);
  if (submissionResult.error) throw new Error(submissionResult.error.message);

  const byStudent = new Map<string, typeof submissionResult.data>();
  for (const row of submissionResult.data ?? []) {
    const rows = byStudent.get(row.class_student_id) ?? [];
    rows.push(row);
    byStudent.set(row.class_student_id, rows);
  }

  return roster.map((student) => {
    const attempts = byStudent.get(student.class_student_id) ?? [];
    const latest = attempts[0];
    return {
      class_student_id: student.class_student_id,
      student_code: student.student_code,
      student_name: student.student_name,
      student_email: student.student_email,
      attempt_count: attempts.length,
      latest_attempt_no: latest?.attempt_no ?? null,
      latest_score: latest?.score ?? null,
      latest_status: (latest?.status as SubmissionStatus | undefined) ?? null,
    };
  });
}

export async function getClassGradeMatrixResultsAction(
  classId: string
): Promise<ClassGradeMatrixResult[]> {
  await requireAdmin();

  const { data: sessions, error: sessionsError } = await supabaseServer
    .from("grading_sessions")
    .select("id")
    .eq("class_id", classId);
  if (sessionsError) throw new Error(sessionsError.message);

  const sessionIds = (sessions ?? []).map((session) => session.id);
  if (!sessionIds.length) return [];

  const { data: submissions, error: submissionsError } = await supabaseServer
    .from("session_submissions")
    .select("class_student_id, grading_session_id, attempt_no, score, status")
    .in("grading_session_id", sessionIds)
    .order("attempt_no", { ascending: false });
  if (submissionsError) throw new Error(submissionsError.message);

  const results = new Map<string, ClassGradeMatrixResult>();
  for (const submission of submissions ?? []) {
    const key = `${submission.class_student_id}:${submission.grading_session_id}`;
    const current = results.get(key);
    if (current) {
      current.attempt_count += 1;
      continue;
    }

    results.set(key, {
      class_student_id: submission.class_student_id,
      grading_session_id: submission.grading_session_id,
      attempt_count: 1,
      latest_attempt_no: submission.attempt_no,
      latest_score: submission.score,
      latest_status: submission.status as SubmissionStatus,
    });
  }

  return Array.from(results.values());
}

export async function getAdminStudentSubmissionsAction(
  classStudentId: string,
  sessionId: string
): Promise<SessionSubmission[]> {
  await requireAdmin();
  const { data, error } = await supabaseServer
    .from("session_submissions")
    .select("*")
    .eq("class_student_id", classStudentId)
    .eq("grading_session_id", sessionId)
    .order("attempt_no", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAdminSessionSubmissionsAction(
  sessionId: string
): Promise<SessionSubmission[]> {
  await requireAdmin();
  const { data, error } = await supabaseServer
    .from("session_submissions")
    .select("*")
    .eq("grading_session_id", sessionId)
    .order("class_student_id")
    .order("attempt_no", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateStudentSubmissionAction(
  submissionId: string,
  payload: { score: number; status: SubmissionStatus; sourceUrl: string }
) {
  await requireAdmin();
  const { data, error } = await supabaseServer
    .from("session_submissions")
    .update({
      score: payload.score,
      status: payload.status,
      source_url: payload.sourceUrl.trim() || null,
      graded_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteStudentSubmissionAction(submissionId: string) {
  await requireAdmin();
  const { count, error: requestError } = await supabaseServer
    .from("resubmission_requests_v2")
    .select("id", { count: "exact", head: true })
    .eq("submission_id", submissionId);
  if (requestError) throw new Error(requestError.message);
  if ((count ?? 0) > 0) throw new Error("This legacy attempt is retained for request audit");
  const { error } = await supabaseServer
    .from("session_submissions")
    .delete()
    .eq("id", submissionId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export interface ImportClassStudentRow {
  email: string;
  studentCode: string;
  name: string;
}

export async function importClassStudentsAction(classId: string, rows: ImportClassStudentRow[]) {
  await requireAdmin();
  const normalizedRows = rows
    .map((row) => ({
      email: row.email.trim().toLowerCase(),
      student_code: row.studentCode.trim().toUpperCase(),
      name: row.name.trim(),
    }))
    .filter((row) => row.email && row.student_code && row.name);
  if (!classId) throw new Error("Class is required");
  if (!normalizedRows.length) throw new Error("No valid student rows found");

  const uniqueRows = Array.from(new Map(normalizedRows.map((row) => [row.email, row])).values());
  let imported = 0;
  let skipped = normalizedRows.length - uniqueRows.length;
  for (const row of uniqueRows) {
    const { data: student, error: studentError } = await supabaseServer
      .from("students")
      .upsert(row, { onConflict: "email" })
      .select("id")
      .single();
    if (studentError || !student) {
      skipped++;
      continue;
    }
    const { error: linkError } = await supabaseServer
      .from("class_students")
      .upsert(
        { class_id: classId, student_id: student.id },
        { onConflict: "class_id, student_id" }
      );
    if (linkError) skipped++;
    else imported++;
  }
  return { imported, skipped, total: normalizedRows.length };
}

export async function removeClassStudentAction(classId: string, classStudentId: string) {
  await requireAdmin();
  if (!classId || !classStudentId) throw new Error("Class and student membership are required");

  const { data, error } = await supabaseServer
    .from("class_students")
    .delete()
    .eq("id", classStudentId)
    .eq("class_id", classId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Student is no longer enrolled in this class");

  return { success: true };
}

export async function createTermAction(
  name: string,
  startsOn: string | null,
  endsOn: string | null
) {
  await requireAdmin();
  const { data, error } = await supabaseServer
    .from("terms")
    .insert({ name: name.trim(), starts_on: startsOn, ends_on: endsOn })
    .select("id, name, starts_on, ends_on")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateTermAction(
  termId: string,
  name: string,
  startsOn: string | null,
  endsOn: string | null
) {
  await requireAdmin();
  const { data, error } = await supabaseServer
    .from("terms")
    .update({ name: name.trim(), starts_on: startsOn, ends_on: endsOn })
    .eq("id", termId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTermAction(termId: string) {
  await requireAdmin();
  const { error } = await supabaseServer.from("terms").delete().eq("id", termId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function createClassAction(termId: string, name: string) {
  await requireAdmin();
  const { data, error } = await supabaseServer
    .from("classes")
    .insert({ term_id: termId, name: name.trim().toUpperCase() })
    .select("id, term_id, name")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateClassAction(classId: string, name: string) {
  await requireAdmin();
  const { data, error } = await supabaseServer
    .from("classes")
    .update({ name: name.trim().toUpperCase() })
    .eq("id", classId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteClassAction(classId: string) {
  await requireAdmin();
  const { error } = await supabaseServer.from("classes").delete().eq("id", classId);
  if (error) throw new Error(error.message);
  return { success: true };
}
