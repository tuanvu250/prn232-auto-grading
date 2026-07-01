import { NextResponse } from "next/server";

import { getServerUser, userIsAdmin } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase";

interface UpdateRequest {
  status?: "pending" | "completed";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getServerUser();
    if (!user || !userIsAdmin(user)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as UpdateRequest;

    if (body.status !== "completed") {
      return NextResponse.json({ success: false, error: "Only completed status is supported" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("resubmission_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
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
