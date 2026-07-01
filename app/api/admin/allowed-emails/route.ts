import { NextResponse } from "next/server";

import { getServerUser, userIsAdmin } from "@/lib/server/auth";
import { createPaginationMeta, parsePagination } from "@/lib/server/pagination";
import { supabaseServer } from "@/lib/server/supabase";

interface AllowedEmailRequest {
  email?: string;
  studentId?: string;
  className?: string;
}

function normalizeEmail(email?: string) {
  return email?.trim().toLowerCase() || "";
}

async function requireAdmin() {
  const user = await getServerUser();
  return user && userIsAdmin(user);
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const { page, pageSize, from, to } = parsePagination(searchParams);

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
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const { data: classRows } = await supabaseServer
      .from("allowed_emails")
      .select("class_name");

    const classCount = new Set((classRows || []).map((row) => row.class_name).filter(Boolean)).size;

    return NextResponse.json({
      success: true,
      data,
      pagination: createPaginationMeta(page, pageSize, count || 0),
      summary: {
        total: count || 0,
        classes: classCount,
      },
    });
  } catch (err) {
    console.error("Error fetching allowed emails:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as AllowedEmailRequest;
    const email = normalizeEmail(body.email);
    const studentId = body.studentId?.trim().toUpperCase() || "";
    const className = body.className?.trim().toUpperCase() || "";

    if (!email || !studentId || !className) {
      return NextResponse.json(
        { success: false, error: "Email, student ID and class are required" },
        { status: 400 }
      );
    }

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
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("Error creating allowed email:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as AllowedEmailRequest;
    const email = normalizeEmail(body.email);
    const studentId = body.studentId?.trim().toUpperCase() || "";
    const className = body.className?.trim().toUpperCase() || "";

    if (!email || !studentId || !className) {
      return NextResponse.json(
        { success: false, error: "Email, student ID and class are required" },
        { status: 400 }
      );
    }

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
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Error updating allowed email:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as AllowedEmailRequest;
    const email = normalizeEmail(body.email);

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from("allowed_emails")
      .delete()
      .eq("email", email);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting allowed email:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
