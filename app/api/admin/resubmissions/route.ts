import { NextResponse } from "next/server";

import { getServerUser, userIsAdmin } from "@/lib/server/auth";
import { createPaginationMeta, parsePagination } from "@/lib/server/pagination";
import { supabaseServer } from "@/lib/server/supabase";

export async function GET(request: Request) {
  try {
    const user = await getServerUser();
    if (!user || !userIsAdmin(user)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const query = searchParams.get("q")?.trim();
    const { page, pageSize, from, to } = parsePagination(searchParams);

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
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const { count: pendingCount } = await supabaseServer
      .from("resubmission_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: completedCount } = await supabaseServer
      .from("resubmission_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed");

    return NextResponse.json({
      success: true,
      data,
      pagination: createPaginationMeta(page, pageSize, count || 0),
      summary: {
        total: (pendingCount || 0) + (completedCount || 0),
        pending: pendingCount || 0,
        completed: completedCount || 0,
      },
    });
  } catch (err) {
    console.error("Error fetching admin resubmissions:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
