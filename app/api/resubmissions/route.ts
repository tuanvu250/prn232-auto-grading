import { NextResponse } from "next/server";

import { notifyDiscordResubmission } from "@/lib/server/discord";
import { getServerUser } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase";

interface ResubmissionRequest {
  labId?: string;
  driveLink?: string;
  note?: string;
}

function isDriveLink(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "drive.google.com" || parsed.hostname.endsWith(".drive.google.com");
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user?.studentId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseServer
      .from("resubmission_requests")
      .select("*")
      .eq("student_id", user.studentId)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Error fetching student resubmissions:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user?.studentId || !user.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ResubmissionRequest;
    const labId = body.labId?.trim();
    const driveLink = body.driveLink?.trim();
    const note = body.note?.trim() || null;

    if (!labId || !driveLink) {
      return NextResponse.json(
        { success: false, error: "Lab ID and Drive link are required" },
        { status: 400 }
      );
    }

    if (!isDriveLink(driveLink)) {
      return NextResponse.json(
        { success: false, error: "Drive link must be a valid Google Drive URL" },
        { status: 400 }
      );
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
      return NextResponse.json({ success: false, error: existingError.message }, { status: 500 });
    }

    if (existingActive?.status === "approved") {
      return NextResponse.json(
        {
          success: false,
          error: "This resubmission has been approved and is waiting to be completed",
        },
        { status: 400 }
      );
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
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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

      return NextResponse.json({ success: true, data });
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
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("Error saving resubmission request:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
