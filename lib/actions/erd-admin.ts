"use server";

import { supabaseServer } from "@/lib/server/supabase";
import { getServerUser, userIsAdmin } from "@/lib/server/auth";
import type {
  Term,
  ClassRow,
  ClassLab,
  ClassStudentRosterRow,
  ClassLabStudentResult,
  ClassLabSubmission,
  ResubmissionRequestV2,
} from "@/lib/types/erd";

async function requireAdmin() {
  const user = await getServerUser();
  if (!user || !userIsAdmin(user)) {
    throw new Error("Forbidden: admin access required");
  }
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

export async function getClassLabsForClassAction(classId: string): Promise<ClassLab[]> {
  await requireAdmin();

  const { data, error } = await supabaseServer
    .from("class_labs")
    .select("id, class_id, lab_id, deadline, labs(code, title)")
    .eq("class_id", classId)
    .order("id");

  if (error) throw new Error(error.message);

  interface ClassLabJoinRow {
    id: string;
    class_id: string;
    lab_id: string;
    deadline: string | null;
    labs: { code: string; title: string | null } | null;
  }

  return ((data ?? []) as unknown as ClassLabJoinRow[]).map((row) => ({
    id: row.id,
    class_id: row.class_id,
    lab_id: row.lab_id,
    deadline: row.deadline,
    lab_code: row.labs?.code ?? "",
    lab_title: row.labs?.title ?? null,
  }));
}

export async function getClassLabStudentResultsAction(
  classLabId: string
): Promise<ClassLabStudentResult[]> {
  await requireAdmin();

  const { data, error } = await supabaseServer.rpc(
    "admin_class_lab_student_results",
    { p_class_lab_id: classLabId }
  );

  if (error) throw new Error(error.message);
  return data ?? [];
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

  interface ClassStudentJoinRow {
    id: string;
    student_id: string;
    students: {
      id: string;
      email: string;
      student_code: string;
      name: string | null;
    } | null;
  }

  return ((data ?? []) as unknown as ClassStudentJoinRow[]).map((row) => ({
    class_student_id: row.id,
    student_id: row.student_id || row.students?.id || "",
    student_code: row.students?.student_code ?? "",
    student_name: row.students?.name ?? null,
    student_email: row.students?.email ?? "",
  }));
}

// Lab catalog management (step 2 of phase-05) -------------------------------------

export async function getLabCatalogAction() {
  await requireAdmin();

  const { data, error } = await supabaseServer
    .from("labs")
    .select("id, code, title")
    .order("code");

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

export async function assignLabToClassAction(
  classId: string,
  labId: string,
  deadline: string | null
) {
  await requireAdmin();

  const { data, error } = await supabaseServer
    .from("class_labs")
    .insert({ class_id: classId, lab_id: labId, deadline })
    .select("id, class_id, lab_id, deadline")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateClassLabDeadlineAction(
  classLabId: string,
  deadline: string | null
) {
  await requireAdmin();

  const { error } = await supabaseServer
    .from("class_labs")
    .update({ deadline })
    .eq("id", classLabId);

  if (error) throw new Error(error.message);
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

export async function getAdminStudentSubmissionsAction(
  classStudentId: string,
  classLabId: string
): Promise<ClassLabSubmission[]> {
  await requireAdmin();

  const { data, error } = await supabaseServer
    .from("class_lab_submissions")
    .select("*")
    .eq("class_student_id", classStudentId)
    .eq("class_lab_id", classLabId)
    .order("attempt_no", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAdminStudentResubmissionsAction(
  classStudentId: string,
  classLabId: string
): Promise<ResubmissionRequestV2[]> {
  await requireAdmin();

  const { data, error } = await supabaseServer
    .from("resubmission_requests_v2")
    .select("*")
    .eq("class_student_id", classStudentId)
    .eq("class_lab_id", classLabId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateStudentSubmissionAction(
  submissionId: string,
  payload: { score: number; status: "passed" | "failed" | "grading"; sourceUrl: string }
) {
  await requireAdmin();

  const { score, status, sourceUrl } = payload;

  const { data, error } = await supabaseServer
    .from("class_lab_submissions")
    .update({
      score,
      status,
      source_url: sourceUrl,
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

  // Xóa các resubmission requests liên kết trước (do constraint ON DELETE RESTRICT)
  const { error: deleteRequestsError } = await supabaseServer
    .from("resubmission_requests_v2")
    .delete()
    .eq("submission_id", submissionId);

  if (deleteRequestsError) {
    throw new Error(`Failed to clean up linked resubmission requests: ${deleteRequestsError.message}`);
  }

  // Xóa submission
  const { error } = await supabaseServer
    .from("class_lab_submissions")
    .delete()
    .eq("id", submissionId)
    .select();

  if (error) throw new Error(error.message);
  return { success: true };
}

export interface ImportClassStudentRow {
  email: string;
  studentCode: string;
  name: string;
}

export async function importClassStudentsAction(
  classId: string,
  rows: ImportClassStudentRow[]
) {
  await requireAdmin();

  const normalizedRows = rows
    .map((row) => ({
      email: row.email.trim().toLowerCase(),
      student_code: row.studentCode.trim().toUpperCase(),
      name: row.name.trim(),
    }))
    .filter((row) => row.email && row.student_code && row.name);

  if (!classId) throw new Error("Class is required");
  if (normalizedRows.length === 0) throw new Error("No valid student rows found");

  const uniqueRows = Array.from(
    new Map(normalizedRows.map((row) => [row.email, row])).values()
  );

  let imported = 0;
  let skipped = normalizedRows.length - uniqueRows.length;

  for (const row of uniqueRows) {
    const { data: student, error: studentError } = await supabaseServer
      .from("students")
      .upsert(
        { email: row.email, student_code: row.student_code, name: row.name },
        { onConflict: "email" }
      )
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

    if (linkError) {
      skipped++;
      continue;
    }

    imported++;
  }

  return {
    imported,
    skipped,
    total: normalizedRows.length,
  };
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
    .update({
      name: name.trim(),
      starts_on: startsOn,
      ends_on: endsOn,
    })
    .eq("id", termId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTermAction(termId: string) {
  await requireAdmin();

  // 1. Lấy danh sách các lớp thuộc term
  const { data: classes, error: selectClassesError } = await supabaseServer
    .from("classes")
    .select("id")
    .eq("term_id", termId);

  if (selectClassesError) throw new Error(selectClassesError.message);

  const classIds = (classes || []).map((c) => c.id);

  if (classIds.length > 0) {
    // 2. Xóa các lớp này (sẽ tự động cascade delete class_students, class_labs, class_lab_submissions)
    const { error: deleteClassesError } = await supabaseServer
      .from("classes")
      .delete()
      .in("id", classIds);

    if (deleteClassesError) {
      throw new Error(`Failed to delete associated classes: ${deleteClassesError.message}`);
    }
  }

  // 3. Xóa term
  const { error } = await supabaseServer
    .from("terms")
    .delete()
    .eq("id", termId)
    .select();

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateClassAction(classId: string, name: string) {
  await requireAdmin();

  const { data, error } = await supabaseServer
    .from("classes")
    .update({
      name: name.trim().toUpperCase(),
    })
    .eq("id", classId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteClassAction(classId: string) {
  await requireAdmin();

  const { error } = await supabaseServer
    .from("classes")
    .delete()
    .eq("id", classId)
    .select();

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function deleteClassLabAction(classLabId: string) {
  await requireAdmin();

  const { error } = await supabaseServer
    .from("class_labs")
    .delete()
    .eq("id", classLabId)
    .select();

  if (error) throw new Error(error.message);
  return { success: true };
}


