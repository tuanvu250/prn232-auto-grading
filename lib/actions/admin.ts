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

    const { data: classRows } = await supabaseServer
      .from("allowed_emails")
      .select("class_name");

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
  } catch (err: any) {
    console.error("Error fetching allowed emails:", err);
    return { success: false, error: err.message || "Internal Server Error" };
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
  } catch (err: any) {
    console.error("Error saving allowed email:", err);
    return { success: false, error: err.message || "Internal Server Error" };
  }
}

export async function deleteAllowedEmailAction(email: string) {
  try {
    await requireAdmin();

    const targetEmail = normalizeEmail(email);

    if (!targetEmail) {
      return { success: false, error: "Email is required" };
    }

    const { error } = await supabaseServer
      .from("allowed_emails")
      .delete()
      .eq("email", targetEmail);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error deleting allowed email:", err);
    return { success: false, error: err.message || "Internal Server Error" };
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
  } catch (err: any) {
    console.error("Error fetching admin resubmissions:", err);
    return { success: false, error: err.message || "Internal Server Error" };
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
  } catch (err: any) {
    console.error("Error updating admin resubmission:", err);
    return { success: false, error: err.message || "Internal Server Error" };
  }
}
