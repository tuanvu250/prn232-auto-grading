"use server";

import { notifyDiscordResubmission } from "@/lib/server/discord";
import { getServerUser } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase";

function isDriveLink(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "drive.google.com" || parsed.hostname.endsWith(".drive.google.com");
  } catch {
    return false;
  }
}

const PENDING_RATE_LIMIT = 5;
const PENDING_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

async function checkPendingRateLimit(studentId: string) {
  const windowStart = new Date(Date.now() - PENDING_RATE_LIMIT_WINDOW_MS).toISOString();

  const { count, error } = await supabaseServer
    .from("resubmission_requests")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("status", "pending")
    .gte("updated_at", windowStart);

  if (error) {
    return { allowed: false, error: error.message };
  }

  if ((count || 0) >= PENDING_RATE_LIMIT) {
    return {
      allowed: false,
      error: "You can only submit or update 5 pending resubmission requests per hour.",
    };
  }

  return { allowed: true };
}

export async function getStudentResubmissionsAction() {
  try {
    const user = await getServerUser();
    if (!user?.studentId) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabaseServer
      .from("resubmission_requests")
      .select("*")
      .eq("student_id", user.studentId)
      .order("updated_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Error fetching student resubmissions:", err);
    return { success: false, error: "Internal Server Error" };
  }
}

export async function createResubmissionAction(payload: {
  labId: string;
  driveLink: string;
  note?: string | null;
}) {
  try {
    const user = await getServerUser();
    if (!user?.studentId || !user.email) {
      return { success: false, error: "Unauthorized" };
    }

    const labId = payload.labId?.trim().toLowerCase();
    const driveLink = payload.driveLink?.trim();
    const note = payload.note?.trim() || null;

    if (!labId || !driveLink) {
      return { success: false, error: "Lab ID and Drive link are required" };
    }

    if (!isDriveLink(driveLink)) {
      return { success: false, error: "Drive link must be a valid Google Drive URL" };
    }

    // Prevent spamming by enforcing a 60-second cooldown between submission actions (create or update)
    const { data: lastRequest, error: lastRequestError } = await supabaseServer
      .from("resubmission_requests")
      .select("updated_at")
      .eq("student_id", user.studentId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRequest && !lastRequestError) {
      const timeSinceLast = Date.now() - new Date(lastRequest.updated_at).getTime();
      if (timeSinceLast < 60000) {
        const secondsLeft = Math.ceil((60000 - timeSinceLast) / 1000);
        return {
          success: false,
          error: `Please wait ${secondsLeft} second(s) before submitting or updating requests again.`,
        };
      }
    }

    const rateLimit = await checkPendingRateLimit(user.studentId);
    if (!rateLimit.allowed) {
      return { success: false, error: rateLimit.error || "Too many pending requests" };
    }

    const { data: existingActive, error: existingError } = await supabaseServer
      .from("resubmission_requests")
      .select("*")
      .eq("student_id", user.studentId)
      .eq("lab_id", labId)
      .in("status", ["pending", "approved"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return { success: false, error: existingError.message };
    }

    if (existingActive?.status === "approved") {
      return {
        success: false,
        error: "This resubmission has been approved and is waiting to be completed",
      };
    }

    if (existingActive) {
      const { data, error } = await supabaseServer
        .from("resubmission_requests")
        .update({
          drive_link: driveLink,
          note,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingActive.id)
        .eq("status", "pending")
        .select("*")
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      await notifyDiscordResubmission({
        action: "updated",
        studentId: user.studentId,
        email: user.email,
        name: user.name,
        className: user.className,
        labId,
        driveLink,
        note: note || undefined,
      });

      return { success: true, data };
    }

    const { data, error } = await supabaseServer
      .from("resubmission_requests")
      .insert({
        student_id: user.studentId,
        email: user.email,
        name: user.name || null,
        class_name: user.className || null,
        lab_id: labId,
        drive_link: driveLink,
        note,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await notifyDiscordResubmission({
      action: "new",
      studentId: user.studentId,
      email: user.email,
      name: user.name,
      className: user.className,
      labId,
      driveLink,
      note: note || undefined,
    });

    return { success: true, data };
  } catch (err) {
    console.error("Error saving resubmission request:", err);
    return { success: false, error: "Internal Server Error" };
  }
}
