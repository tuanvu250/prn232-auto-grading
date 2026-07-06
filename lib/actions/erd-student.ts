"use server";

import { supabaseServer } from "@/lib/server/supabase";
import { getServerUser } from "@/lib/server/auth";
import { notifyDiscordResubmission } from "@/lib/server/discord";
import type {
  ClassLabSubmission,
  ResubmissionRequestV2,
  StudentClassLabOverview,
} from "@/lib/types/erd";

async function requireStudentUser() {
  const user = await getServerUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

// Resolves the logged-in JWT identity to the row in class_students that represents
// their current enrollment. The JWT only carries email/className strings, not the new
// schema's UUIDs, so this joins by email + class name and — when a student is enrolled
// in the same-named class across multiple terms — prefers the most recently started
// term as "current", matching the single-current-term assumption used by the Phase 2
// migration. Full multi-term disambiguation is out of scope (no auth rebuild).
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

  const { data: rows, error } = await supabaseServer
    .from("class_students")
    .select("id, classes!inner(id, name, term_id, terms!inner(starts_on))")
    .eq("student_id", student.id)
    .eq("classes.name", user.className.trim().toUpperCase())
    .order("starts_on", { referencedTable: "classes.terms", ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return rows?.[0]?.id ?? null;
}

export async function getStudentLabOverviewAction(): Promise<StudentClassLabOverview[]> {
  const classStudentId = await getCurrentClassStudentIdAction();
  if (!classStudentId) return [];

  const { data, error } = await supabaseServer.rpc("student_class_lab_overview", {
    p_class_student_id: classStudentId,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClassLabAttemptsAction(
  classLabId: string
): Promise<ClassLabSubmission[]> {
  const classStudentId = await getCurrentClassStudentIdAction();
  if (!classStudentId) return [];

  const { data, error } = await supabaseServer
    .from("class_lab_submissions")
    .select("*")
    .eq("class_student_id", classStudentId)
    .eq("class_lab_id", classLabId)
    .order("attempt_no", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSubmissionDetailAction(
  submissionId: string
): Promise<ClassLabSubmission | null> {
  const classStudentId = await getCurrentClassStudentIdAction();
  if (!classStudentId) return null;

  const { data, error } = await supabaseServer
    .from("class_lab_submissions")
    .select("*")
    .eq("id", submissionId)
    .eq("class_student_id", classStudentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getResubmissionRequestForClassLabAction(
  classLabId: string
): Promise<ResubmissionRequestV2 | null> {
  const classStudentId = await getCurrentClassStudentIdAction();
  if (!classStudentId) return null;

  const { data, error } = await supabaseServer
    .from("resubmission_requests_v2")
    .select("*")
    .eq("class_student_id", classStudentId)
    .eq("class_lab_id", classLabId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getClassLabSubmissionAccessAction(
  classLabId: string
): Promise<Pick<StudentClassLabOverview, "class_lab_id" | "lab_code" | "lab_title" | "deadline" | "drive_root_url"> | null> {
  const classStudentId = await getCurrentClassStudentIdAction();
  if (!classStudentId) return null;

  const { data, error } = await supabaseServer
    .from("class_labs")
    .select("id, class_id, deadline, drive_root_url, labs(code, title)")
    .eq("id", classLabId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: enrollment, error: enrollmentError } = await supabaseServer
    .from("class_students")
    .select("id")
    .eq("id", classStudentId)
    .eq("class_id", data.class_id)
    .maybeSingle();

  if (enrollmentError) throw new Error(enrollmentError.message);
  if (!enrollment) return null;

  const lab = Array.isArray(data.labs) ? data.labs[0] : data.labs;
  return {
    class_lab_id: data.id,
    lab_code: lab?.code ?? "",
    lab_title: lab?.title ?? null,
    deadline: data.deadline ?? null,
    drive_root_url: data.drive_root_url ?? null,
  };
}

function isDriveLink(url: string) {
  try {
    const parsed = new URL(url.trim());
    return (
      parsed.hostname === "drive.google.com" || parsed.hostname.endsWith(".drive.google.com")
    );
  } catch {
    return false;
  }
}

const RESUBMIT_COOLDOWN_MS = 60_000;
const RESUBMIT_PENDING_LIMIT = 5;
const RESUBMIT_PENDING_WINDOW_MS = 60 * 60 * 1000;

// Time-based anti-spam (60s cooldown, 5 pending/hour) is independent from the 3-attempt
// historical cap enforced by the create_resubmission_request RPC below — the two checks
// must not be conflated: this function only blocks based on *when* requests were made,
// never based on *how many* a lab has ever had.
async function checkResubmissionRateLimit(classStudentId: string) {
  const { data: lastRequest, error: lastError } = await supabaseServer
    .from("resubmission_requests_v2")
    .select("updated_at")
    .eq("class_student_id", classStudentId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastError) throw new Error(lastError.message);

  if (lastRequest) {
    const elapsed = Date.now() - new Date(lastRequest.updated_at).getTime();
    if (elapsed < RESUBMIT_COOLDOWN_MS) {
      const secondsLeft = Math.ceil((RESUBMIT_COOLDOWN_MS - elapsed) / 1000);
      return { allowed: false, error: `Please wait ${secondsLeft}s before trying again.` };
    }
  }

  const windowStart = new Date(Date.now() - RESUBMIT_PENDING_WINDOW_MS).toISOString();
  const { count, error: countError } = await supabaseServer
    .from("resubmission_requests_v2")
    .select("id", { count: "exact", head: true })
    .eq("class_student_id", classStudentId)
    .eq("status", "pending")
    .gte("updated_at", windowStart);

  if (countError) throw new Error(countError.message);

  if ((count || 0) >= RESUBMIT_PENDING_LIMIT) {
    return {
      allowed: false,
      error: `You can only submit ${RESUBMIT_PENDING_LIMIT} pending requests per hour.`,
    };
  }

  return { allowed: true };
}

async function getClassLabDisplayName(classLabId: string) {
  const { data, error } = await supabaseServer
    .from("class_labs")
    .select("labs(code, title)")
    .eq("id", classLabId)
    .maybeSingle();

  if (error) {
    console.error("Error resolving class lab display name:", error.message);
    return classLabId;
  }

  const lab = Array.isArray(data?.labs) ? data.labs[0] : data?.labs;
  const code = lab?.code?.trim();
  const title = lab?.title?.trim();

  if (code && title) return `${code} - ${title}`;
  return code || title || classLabId;
}

export interface CreateResubmissionResult {
  success: boolean;
  error?: string;
}

// Creates a resubmission request for the latest attempt of one specific class_lab.
// The student must explicitly pick classLabId themselves (see the dashboard's dialog) —
// this action never infers it from "the lab currently being viewed" or "the most recent
// lab", per the product requirement that a request cannot be ambiguous about its target.
export async function createResubmissionRequestAction(
  classLabId: string,
  driveLink: string,
  note: string | null,
  requestType: "late" | "resubmit" = "resubmit"
): Promise<CreateResubmissionResult> {
  const user = await requireStudentUser();
  const classStudentId = await getCurrentClassStudentIdAction();
  if (!classStudentId) return { success: false, error: "Student enrollment not found" };

  const trimmedLink = driveLink.trim();
  if (!isDriveLink(trimmedLink)) {
    return { success: false, error: "Link must be a Google Drive/Docs link" };
  }

  const rateLimit = await checkResubmissionRateLimit(classStudentId);
  if (!rateLimit.allowed) {
    return { success: false, error: rateLimit.error };
  }

  const { data: classLab, error: classLabError } = await supabaseServer
    .from("class_labs")
    .select("deadline")
    .eq("id", classLabId)
    .maybeSingle();

  if (classLabError) throw new Error(classLabError.message);
  if (!classLab) return { success: false, error: "Lab assignment not found" };

  const { data: submission, error: submissionError } = await supabaseServer
    .from("class_lab_submissions")
    .select("id, class_lab_id")
    .eq("class_student_id", classStudentId)
    .eq("class_lab_id", classLabId)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (submissionError) throw new Error(submissionError.message);
  if (requestType === "resubmit" && !submission) {
    return { success: false, error: "You haven't submitted this lab yet" };
  }
  if (requestType === "late" && submission) {
    return {
      success: false,
      error: "You already have a submission. Please request a resubmission instead.",
    };
  }
  if (requestType === "late" && classLab.deadline) {
    const deadlineTime = new Date(classLab.deadline).getTime();
    if (Number.isFinite(deadlineTime) && deadlineTime > Date.now()) {
      return { success: false, error: "Late submission requests open after the deadline." };
    }
  }

  const { error: rpcError } = await supabaseServer.rpc("create_resubmission_request", {
    p_class_student_id: classStudentId,
    p_class_lab_id: submission?.class_lab_id ?? classLabId,
    p_submission_id: submission?.id ?? null,
    p_drive_link: trimmedLink,
    p_note: note?.trim() || null,
    p_request_type: requestType,
  });

  if (rpcError) {
    if (rpcError.message.includes("resubmission_limit_reached")) {
      return { success: false, error: "Resubmission limit reached (max 3 per lab)" };
    }
    throw new Error(rpcError.message);
  }

  const labDisplayName = await getClassLabDisplayName(submission?.class_lab_id ?? classLabId);

  await notifyDiscordResubmission({
    action: "new",
    studentId: user.studentId || user.email,
    email: user.email,
    name: user.name || user.email,
    className: user.className || "",
    labId: requestType === "late" ? `${labDisplayName} (Late submission)` : labDisplayName,
    driveLink: trimmedLink,
    note: note?.trim() || undefined,
  });

  return { success: true };
}
