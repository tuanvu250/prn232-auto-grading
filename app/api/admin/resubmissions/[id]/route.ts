import { NextResponse } from "next/server";

import { getServerUser, userIsAdmin } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase";

interface UpdateRequest {
  status?: "approved" | "rejected" | "completed";
  adminNote?: string;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getServerUser();
    if (!user || !userIsAdmin(user)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as UpdateRequest;

    if (body.status !== "approved" && body.status !== "rejected" && body.status !== "completed") {
      return NextResponse.json(
        { success: false, error: "Only approved, rejected or completed status is supported" },
        { status: 400 }
      );
    }

    const adminNote = body.adminNote?.trim() || null;
    if (body.status === "rejected" && !adminNote) {
      return NextResponse.json(
        { success: false, error: "Reject note is required" },
        { status: 400 }
      );
    }

    const fromStatus = body.status === "completed" ? "approved" : "pending";

    const { data, error } = await supabaseServer
      .from("resubmission_requests")
      .update({
        status: body.status,
        admin_note: adminNote,
        completed_at: new Date().toISOString(),
        completed_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", fromStatus)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Error updating admin resubmission:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
