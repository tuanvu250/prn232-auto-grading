"use server";

import { supabaseServer } from "@/lib/server/supabase";
import { getServerUser, userIsAdmin } from "@/lib/server/auth";
import type {
  Term,
  ClassRow,
  ClassLab,
  ClassLabStudentResult,
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
