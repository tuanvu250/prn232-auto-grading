"use server";

import { getServerUser, userIsAdmin } from "@/lib/server/auth";
import { createPaginationMeta } from "@/lib/server/pagination";
import { supabaseServer } from "@/lib/server/supabase";

async function requireAdmin() {
  const user = await getServerUser();
  if (!user || !userIsAdmin(user)) {
    throw new Error("Forbidden");
  }
  return user;
}

function normalizeEmail(email?: string) {
  return email?.trim().toLowerCase() || "";
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Internal Server Error";
}

type SubmissionRow = {
  student_id: string;
  lab_id: string;
  class_name?: string | null;
  score?: number | string | null;
  status?: string | null;
  updated_at?: string | null;
};

function mapSubmissionStatus(submission?: SubmissionRow | null) {
  if (!submission) return "Not Submitted";

  const rawStatus = submission.status?.toLowerCase() || "";
  if (rawStatus === "grading" || rawStatus === "pending") return "Grading";

  const score = Number(submission.score) || 0;
  return score >= 5 ? "Passed" : "Failed";
}

// ----------------- Whitelist (Allowed Emails) Actions -----------------

export async function getAllowedEmailsAction(params: {
  q?: string;
  page: number;
  pageSize: number;
}) {
  try {
    await requireAdmin();

    const query = params.q?.trim();
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let allowedQuery = supabaseServer
      .from("allowed_emails")
      .select("email, student_id, class_name", { count: "exact" })
      .order("class_name", { ascending: true })
      .order("student_id", { ascending: true });

    if (query) {
      allowedQuery = allowedQuery.or(
        `email.ilike.%${query}%,student_id.ilike.%${query}%,class_name.ilike.%${query}%`
      );
    }

    const { data, count, error } = await allowedQuery.range(from, to);

    if (error) {
      return { success: false, error: error.message };
    }

    const { data: classRows } = await supabaseServer.from("allowed_emails").select("class_name");

    const classCount = new Set((classRows || []).map((row) => row.class_name).filter(Boolean)).size;

    return {
      success: true,
      data,
      pagination: createPaginationMeta(page, pageSize, count || 0),
      summary: {
        total: count || 0,
        classes: classCount,
      },
    };
  } catch (err: unknown) {
    console.error("Error fetching allowed emails:", err);
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function saveAllowedEmailAction(payload: {
  email: string;
  studentId: string;
  className: string;
  isEdit: boolean;
}) {
  try {
    await requireAdmin();

    const email = normalizeEmail(payload.email);
    const studentId = payload.studentId?.trim().toUpperCase() || "";
    const className = payload.className?.trim().toUpperCase() || "";

    if (!email || !studentId || !className) {
      return { success: false, error: "Email, student ID and class are required" };
    }

    if (payload.isEdit) {
      // PATCH update
      const { data, error } = await supabaseServer
        .from("allowed_emails")
        .update({
          student_id: studentId,
          class_name: className,
        })
        .eq("email", email)
        .select("email, student_id, class_name")
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } else {
      // POST insert
      const { data, error } = await supabaseServer
        .from("allowed_emails")
        .insert({
          email,
          student_id: studentId,
          class_name: className,
        })
        .select("email, student_id, class_name")
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    }
  } catch (err: unknown) {
    console.error("Error saving allowed email:", err);
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function deleteAllowedEmailAction(email: string) {
  try {
    await requireAdmin();

    const targetEmail = normalizeEmail(email);

    if (!targetEmail) {
      return { success: false, error: "Email is required" };
    }

    const { error } = await supabaseServer.from("allowed_emails").delete().eq("email", targetEmail);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    console.error("Error deleting allowed email:", err);
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function importAllowedEmailsAction(
  rows: Array<{
    email: string;
    studentId: string;
    className: string;
  }>
) {
  try {
    await requireAdmin();

    const normalizedRows = rows
      .map((row) => ({
        email: normalizeEmail(row.email),
        student_id: row.studentId?.trim().toUpperCase() || "",
        class_name: row.className?.trim().toUpperCase() || "",
      }))
      .filter((row) => row.email && row.student_id && row.class_name);

    if (normalizedRows.length === 0) {
      return { success: false, error: "No valid student rows found" };
    }

    const uniqueRows = Array.from(new Map(normalizedRows.map((row) => [row.email, row])).values());

    const { error } = await supabaseServer
      .from("allowed_emails")
      .upsert(uniqueRows, { onConflict: "email" });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      imported: uniqueRows.length,
      skipped: rows.length - normalizedRows.length,
      duplicates: normalizedRows.length - uniqueRows.length,
    };
  } catch (err: unknown) {
    console.error("Error importing allowed emails:", err);
    return { success: false, error: getErrorMessage(err) };
  }
}

// ----------------- Student Results Actions -----------------

export async function getAdminStudentResultFiltersAction(className?: string) {
  try {
    await requireAdmin();

    const { data: classRows, error: classError } = await supabaseServer
      .from("allowed_emails")
      .select("class_name")
      .order("class_name", { ascending: true });

    if (classError) {
      return { success: false, error: classError.message };
    }

    const classes = Array.from(
      new Set((classRows || []).map((row) => row.class_name).filter(Boolean))
    );

    let labs: string[] = [];
    const targetClass = className?.trim();

    if (targetClass) {
      const { data: labRows, error: labError } = await supabaseServer
        .from("submissions")
        .select("lab_id")
        .eq("class_name", targetClass)
        .order("lab_id", { ascending: true });

      if (labError) {
        return { success: false, error: labError.message };
      }

      labs = Array.from(new Set((labRows || []).map((row) => row.lab_id).filter(Boolean)));
    }

    return { success: true, classes, labs };
  } catch (err: unknown) {
    console.error("Error fetching admin student result filters:", err);
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function getAdminStudentResultsAction(params: {
  className: string;
  labId: string;
  q?: string;
  page: number;
  pageSize: number;
}) {
  try {
    await requireAdmin();

    const className = params.className?.trim();
    const labId = params.labId?.trim();
    const query = params.q?.trim();
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (!className || !labId) {
      return { success: false, error: "Class and lab are required" };
    }

    let rosterQuery = supabaseServer
      .from("allowed_emails")
      .select("email, student_id, class_name", { count: "exact" })
      .eq("class_name", className)
      .order("student_id", { ascending: true });

    if (query) {
      rosterQuery = rosterQuery.or(`email.ilike.%${query}%,student_id.ilike.%${query}%`);
    }

    const { data: rosterRows, count, error: rosterError } = await rosterQuery.range(from, to);

    if (rosterError) {
      return { success: false, error: rosterError.message };
    }

    const pageStudentIds = (rosterRows || []).map((row) => row.student_id).filter(Boolean);

    let pageSubmissions: SubmissionRow[] = [];
    if (pageStudentIds.length > 0) {
      const { data: submissionRows, error: submissionError } = await supabaseServer
        .from("submissions")
        .select("student_id, lab_id, class_name, score, status, updated_at")
        .eq("class_name", className)
        .eq("lab_id", labId)
        .in("student_id", pageStudentIds);

      if (submissionError) {
        return { success: false, error: submissionError.message };
      }

      pageSubmissions = submissionRows || [];
    }

    const submissionByStudent = new Map(
      pageSubmissions.map((submission) => [submission.student_id, submission])
    );

    const rows = (rosterRows || []).map((student) => {
      const submission = submissionByStudent.get(student.student_id);
      const score =
        submission?.score === null || submission?.score === undefined
          ? null
          : Number(submission.score);

      return {
        email: student.email,
        student_id: student.student_id,
        class_name: student.class_name,
        lab_id: labId,
        score,
        raw_status: submission?.status || null,
        status: mapSubmissionStatus(submission),
        updated_at: submission?.updated_at || null,
      };
    });

    const { data: fullRosterRows, error: fullRosterError } = await supabaseServer
      .from("allowed_emails")
      .select("student_id")
      .eq("class_name", className);

    if (fullRosterError) {
      return { success: false, error: fullRosterError.message };
    }

    const { data: fullSubmissionRows, error: fullSubmissionError } = await supabaseServer
      .from("submissions")
      .select("student_id, lab_id, class_name, score, status, updated_at")
      .eq("class_name", className)
      .eq("lab_id", labId);

    if (fullSubmissionError) {
      return { success: false, error: fullSubmissionError.message };
    }

    const fullSubmissionByStudent = new Map(
      (fullSubmissionRows || []).map((submission) => [submission.student_id, submission])
    );
    const rosterStudentIds = (fullRosterRows || []).map((row) => row.student_id).filter(Boolean);
    const submittedRows = rosterStudentIds
      .map((studentId) => fullSubmissionByStudent.get(studentId))
      .filter(Boolean) as SubmissionRow[];

    const scores = submittedRows
      .map((submission) => Number(submission.score))
      .filter((score) => Number.isFinite(score));
    const passed = submittedRows.filter(
      (submission) => mapSubmissionStatus(submission) === "Passed"
    ).length;
    const grading = submittedRows.filter(
      (submission) => mapSubmissionStatus(submission) === "Grading"
    ).length;
    const failed = submittedRows.filter(
      (submission) => mapSubmissionStatus(submission) === "Failed"
    ).length;

    return {
      success: true,
      data: rows,
      pagination: createPaginationMeta(page, pageSize, count || 0),
      summary: {
        total: rosterStudentIds.length,
        submitted: submittedRows.length,
        notSubmitted: Math.max(rosterStudentIds.length - submittedRows.length, 0),
        passed,
        failed,
        grading,
        averageScore:
          scores.length > 0
            ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2))
            : null,
      },
    };
  } catch (err: unknown) {
    console.error("Error fetching admin student results:", err);
    return { success: false, error: getErrorMessage(err) };
  }
}

// ----------------- Resubmission Management Actions -----------------

export async function getAdminResubmissionsAction(params: {
  status: string;
  q?: string;
  page: number;
  pageSize: number;
}) {
  try {
    await requireAdmin();

    const status = params.status;
    const query = params.q?.trim();
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let requestQuery = supabaseServer
      .from("resubmission_requests")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false });

    if (status && status !== "all") {
      requestQuery = requestQuery.eq("status", status);
    }

    if (query) {
      requestQuery = requestQuery.or(
        `student_id.ilike.%${query}%,email.ilike.%${query}%,class_name.ilike.%${query}%,lab_id.ilike.%${query}%`
      );
    }

    const { data, count, error } = await requestQuery.range(from, to);

    if (error) {
      return { success: false, error: error.message };
    }

    const { count: pendingCount } = await supabaseServer
      .from("resubmission_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: approvedCount } = await supabaseServer
      .from("resubmission_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved");

    const { count: rejectedCount } = await supabaseServer
      .from("resubmission_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejected");

    const { count: completedCount } = await supabaseServer
      .from("resubmission_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed");

    return {
      success: true,
      data,
      pagination: createPaginationMeta(page, pageSize, count || 0),
      summary: {
        total:
          (pendingCount || 0) + (approvedCount || 0) + (rejectedCount || 0) + (completedCount || 0),
        pending: pendingCount || 0,
        approved: approvedCount || 0,
        rejected: rejectedCount || 0,
        completed: completedCount || 0,
      },
    };
  } catch (err: unknown) {
    console.error("Error fetching admin resubmissions:", err);
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function updateResubmissionStatusAction(
  id: string,
  status: "approved" | "rejected" | "completed",
  adminNote?: string
) {
  try {
    const user = await requireAdmin();

    if (status !== "approved" && status !== "rejected" && status !== "completed") {
      return { success: false, error: "Only approved, rejected or completed status is supported" };
    }

    const targetAdminNote = adminNote?.trim() || null;
    if (status === "rejected" && !targetAdminNote) {
      return { success: false, error: "Reject note is required" };
    }

    const fromStatus = status === "completed" ? "approved" : "pending";

    const { data, error } = await supabaseServer
      .from("resubmission_requests")
      .update({
        status: status,
        admin_note: targetAdminNote,
        completed_at: new Date().toISOString(),
        completed_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", fromStatus)
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: unknown) {
    console.error("Error updating admin resubmission:", err);
    return { success: false, error: getErrorMessage(err) };
  }
}
