import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtDecode } from "jwt-decode";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Initialize Supabase Client with service role key for secure server-side operations
const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

interface UserPayload {
  studentId?: string;
  role: string;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("authToken")?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const decoded = jwtDecode<UserPayload>(token);
    const studentId = decoded.studentId;

    if (!studentId) {
      return NextResponse.json({ success: false, error: "Student ID not found in token" }, { status: 400 });
    }

    // Query submissions for the authenticated student ID
    const { data, error } = await supabaseServer
      .from("submissions")
      .select("*")
      .eq("student_id", studentId)
      .order("lab_id", { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching grades from Supabase:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
