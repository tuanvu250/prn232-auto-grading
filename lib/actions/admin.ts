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
  className?: string;
  page: number;
  pageSize: number;
}) {
  try {
    await requireAdmin();

    const query = params.q?.trim();
    const className = params.className?.trim();
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let selectStr = "email, student_code, name, class_students(classes(name))";
    if (className && className !== "all") {
      selectStr = "email, student_code, name, class_students!inner(classes!inner(name))";
    }

    let allowedQuery = supabaseServer
      .from("students")
      .select(selectStr, { count: "exact" })
      .order("student_code", { ascending: true });

    if (query) {
      allowedQuery = allowedQuery.or(
        `email.ilike.%${query}%,student_code.ilike.%${query}%,name.ilike.%${query}%`
      );
    }

    if (className && className !== "all") {
      allowedQuery = allowedQuery.eq("class_students.classes.name", className);
    }

    const { data, count, error } = await allowedQuery.range(from, to);

    if (error) {
      return { success: false, error: error.message };
    }

    const rows = (data || []).map((student: any) => {
      const classes = student.class_students?.[0]?.classes;
      return {
        email: student.email,
        student_id: student.student_code,
        class_name: classes?.name || "",
        name: student.name || "",
      };
    });

    const { data: classRows } = await supabaseServer.from("classes").select("name");
    const classCount = new Set((classRows || []).map((row) => row.name).filter(Boolean)).size;
    const classNames = Array.from(
      new Set((classRows || []).map((row) => row.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    return {
      success: true,
      data: rows,
      pagination: createPaginationMeta(page, pageSize, count || 0),
      summary: {
        total: count || 0,
        classes: classCount,
        classNames,
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
  name?: string;
  isEdit: boolean;
}) {
  try {
    await requireAdmin();

    const email = normalizeEmail(payload.email);
    const studentId = payload.studentId?.trim().toUpperCase() || "";
    const className = payload.className?.trim().toUpperCase() || "";
    const name = payload.name?.trim() || "";

    if (!email || !studentId || !className) {
      return { success: false, error: "Email, student ID and class are required" };
    }

    // 1. Tìm hoặc tạo class
    let classId = "";
    const { data: classObj, error: classFindErr } = await supabaseServer
      .from("classes")
      .select("id")
      .eq("name", className)
      .limit(1)
      .maybeSingle();

    if (classFindErr) {
      return { success: false, error: classFindErr.message };
    }

    if (classObj) {
      classId = classObj.id;
    } else {
      // Tìm term mới nhất để chèn lớp vào
      const { data: term, error: termErr } = await supabaseServer
        .from("terms")
        .select("id")
        .order("starts_on", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (termErr) {
        return { success: false, error: termErr.message };
      }
      if (!term) {
        return { success: false, error: "No active term found. Please create a term first." };
      }

      const { data: newClass, error: createClassErr } = await supabaseServer
        .from("classes")
        .insert({ term_id: term.id, name: className })
        .select("id")
        .single();

      if (createClassErr) {
        return { success: false, error: createClassErr.message };
      }
      classId = newClass.id;
    }

    // 2. Upsert student vào bảng students
    const { data: student, error: studentErr } = await supabaseServer
      .from("students")
      .upsert(
        { email, student_code: studentId, name: name || null },
        { onConflict: "email" }
      )
      .select("id")
      .single();

    if (studentErr) {
      return { success: false, error: studentErr.message };
    }

    // 3. Xử lý liên kết class_students
    if (payload.isEdit) {
      // Nếu là edit, xóa các liên kết lớp học cũ của student này trước để tránh trùng lặp
      await supabaseServer
        .from("class_students")
        .delete()
        .eq("student_id", student.id);
    }

    const { error: linkErr } = await supabaseServer
      .from("class_students")
      .upsert(
        { class_id: classId, student_id: student.id },
        { onConflict: "class_id, student_id" }
      );

    if (linkErr) {
      return { success: false, error: linkErr.message };
    }

    return {
      success: true,
      data: {
        email,
        student_id: studentId,
        class_name: className,
        name,
      },
    };
  } catch (err: unknown) {
    console.error("Error saving student access:", err);
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

    const { error } = await supabaseServer.from("students").delete().eq("email", targetEmail);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    console.error("Error deleting student access:", err);
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function importAllowedEmailsAction(
  rows: Array<{
    email: string;
    studentId: string;
    className: string;
    name?: string;
  }>
) {
  try {
    await requireAdmin();

    const normalizedRows = rows
      .map((row) => ({
        email: normalizeEmail(row.email),
        student_id: row.studentId?.trim().toUpperCase() || "",
        class_name: row.className?.trim().toUpperCase() || "",
        name: row.name?.trim() || "",
      }))
      .filter((row) => row.email && row.student_id && row.class_name);

    if (normalizedRows.length === 0) {
      return { success: false, error: "No valid student rows found" };
    }

    // Lấy danh sách duy nhất các class_name cần import để chuẩn bị class_id
    const uniqueClassNames = Array.from(new Set(normalizedRows.map((r) => r.class_name)));
    const classIdMap = new Map<string, string>();

    // Lấy term mới nhất làm term mặc định nếu phải tạo lớp mới
    const { data: term } = await supabaseServer
      .from("terms")
      .select("id")
      .order("starts_on", { ascending: false })
      .limit(1)
      .maybeSingle();

    for (const cName of uniqueClassNames) {
      const { data: classObj } = await supabaseServer
        .from("classes")
        .select("id")
        .eq("name", cName)
        .limit(1)
        .maybeSingle();

      if (classObj) {
        classIdMap.set(cName, classObj.id);
      } else if (term) {
        const { data: newClass } = await supabaseServer
          .from("classes")
          .insert({ term_id: term.id, name: cName })
          .select("id")
          .single();
        if (newClass) {
          classIdMap.set(cName, newClass.id);
        }
      }
    }

    let importedCount = 0;
    // Thực hiện lưu từng sinh viên
    for (const row of normalizedRows) {
      const classId = classIdMap.get(row.class_name);
      if (!classId) continue;

      const { data: student, error: studentErr } = await supabaseServer
        .from("students")
        .upsert(
          { email: row.email, student_code: row.student_id, name: row.name || null },
          { onConflict: "email" }
        )
        .select("id")
        .single();

      if (studentErr || !student) continue;

      const { error: linkErr } = await supabaseServer
        .from("class_students")
        .upsert(
          { class_id: classId, student_id: student.id },
          { onConflict: "class_id, student_id" }
        );

      if (!linkErr) {
        importedCount++;
      }
    }

    return {
      success: true,
      imported: importedCount,
      skipped: rows.length - importedCount,
      duplicates: 0,
    };
  } catch (err: unknown) {
    console.error("Error importing students:", err);
    return { success: false, error: getErrorMessage(err) };
  }
}

// ----------------- Student Results Actions -----------------

export async function getAdminStudentResultFiltersAction(className?: string) {
  try {
    await requireAdmin();

    const { data: classRows, error: classError } = await supabaseServer
      .from("classes")
      .select("name")
      .order("name", { ascending: true });

    if (classError) {
      return { success: false, error: classError.message };
    }

    const classes = Array.from(
      new Set((classRows || []).map((row) => row.name).filter(Boolean))
    );

    let labs: string[] = [];
    const targetClass = className?.trim();

    if (targetClass) {
      const { data: labRows, error: labError } = await supabaseServer
        .from("class_labs")
        .select("labs!inner(code), classes!inner(name)")
        .eq("classes.name", targetClass);

      if (labError) {
        return { success: false, error: labError.message };
      }

      labs = Array.from(
        new Set((labRows || []).map((row: any) => row.labs?.code).filter(Boolean))
      ).sort();
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
      .from("class_students")
      .select("id, students!inner(email, student_code), classes!inner(name)", { count: "exact" })
      .eq("classes.name", className)
      .order("student_code", { referencedTable: "students", ascending: true });

    if (query) {
      rosterQuery = rosterQuery.or(
        `email.ilike.%${query}%,student_code.ilike.%${query}%`,
        { referencedTable: "students" }
      );
    }

    const { data: rosterRows, count, error: rosterError } = await rosterQuery.range(from, to);

    if (rosterError) {
      return { success: false, error: rosterError.message };
    }

    const pageClassStudentIds = (rosterRows || []).map((row) => row.id).filter(Boolean);

    let pageSubmissions: any[] = [];
    if (pageClassStudentIds.length > 0) {
      const { data: submissionRows, error: submissionError } = await supabaseServer
        .from("class_lab_submissions")
        .select("class_student_id, score, status, submitted_at, class_labs!inner(labs!inner(code))")
        .in("class_student_id", pageClassStudentIds)
        .eq("class_labs.labs.code", labId);

      if (submissionError) {
        return { success: false, error: submissionError.message };
      }

      pageSubmissions = submissionRows || [];
    }

    const latestSubmissionByStudent = new Map<string, any>();
    for (const sub of pageSubmissions) {
      const existing = latestSubmissionByStudent.get(sub.class_student_id);
      if (!existing || new Date(sub.submitted_at) > new Date(existing.submitted_at)) {
        latestSubmissionByStudent.set(sub.class_student_id, sub);
      }
    }

    const rows = (rosterRows || []).map((row: any) => {
      const student = row.students;
      const submission = latestSubmissionByStudent.get(row.id);
      const score =
        submission?.score === null || submission?.score === undefined
          ? null
          : Number(submission.score);

      let displayStatus = "Not submitted";
      if (submission) {
        const s = submission.status?.toLowerCase();
        if (s === "passed") displayStatus = "Passed";
        else if (s === "failed") displayStatus = "Failed";
        else displayStatus = "Grading";
      }

      return {
        email: student?.email || "",
        student_id: student?.student_code || "",
        class_name: className,
        lab_id: labId,
        score,
        raw_status: submission?.status || null,
        status: displayStatus,
        updated_at: submission?.submitted_at || null,
      };
    });

    const { data: fullRosterRows, error: fullRosterError } = await supabaseServer
      .from("class_students")
      .select("id, classes!inner(name)")
      .eq("classes.name", className);

    if (fullRosterError) {
      return { success: false, error: fullRosterError.message };
    }

    const fullClassStudentIds = (fullRosterRows || []).map((row) => row.id);

    let fullSubmissions: any[] = [];
    if (fullClassStudentIds.length > 0) {
      const { data: fullSubRows } = await supabaseServer
        .from("class_lab_submissions")
        .select("class_student_id, score, status, submitted_at, class_labs!inner(labs!inner(code))")
        .in("class_student_id", fullClassStudentIds)
        .eq("class_labs.labs.code", labId);
      fullSubmissions = fullSubRows || [];
    }

    const latestFullSubByStudent = new Map<string, any>();
    for (const sub of fullSubmissions) {
      const existing = latestFullSubByStudent.get(sub.class_student_id);
      if (!existing || new Date(sub.submitted_at) > new Date(existing.submitted_at)) {
        latestFullSubByStudent.set(sub.class_student_id, sub);
      }
    }

    const submittedCount = latestFullSubByStudent.size;
    const notSubmitted = Math.max(fullClassStudentIds.length - submittedCount, 0);

    let passed = 0;
    let failed = 0;
    let grading = 0;
    const scores: number[] = [];

    for (const sub of latestFullSubByStudent.values()) {
      if (sub.score !== null && sub.score !== undefined) {
        scores.push(Number(sub.score));
      }
      const s = sub.status?.toLowerCase();
      if (s === "passed") passed++;
      else if (s === "failed") failed++;
      else grading++;
    }

    const averageScore =
      scores.length > 0
        ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2))
        : null;

    return {
      success: true,
      data: rows,
      pagination: createPaginationMeta(page, pageSize, count || 0),
      summary: {
        total: fullClassStudentIds.length,
        submitted: submittedCount,
        notSubmitted,
        passed,
        failed,
        grading,
        averageScore,
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
      .from("resubmission_requests_v2")
      .select(`
        id,
        drive_link,
        note,
        admin_note,
        status,
        completed_at,
        completed_by,
        created_at,
        updated_at,
        class_students!inner(
          students!inner(email, student_code, name),
          classes!inner(name)
        ),
        class_labs!inner(
          labs!inner(code)
        )
      `, { count: "exact" })
      .order("updated_at", { ascending: false });

    if (status && status !== "all") {
      requestQuery = requestQuery.eq("status", status);
    }

    if (query) {
      requestQuery = requestQuery.or(
        `class_students.students.student_code.ilike.%${query}%,` +
        `class_students.students.email.ilike.%${query}%,` +
        `class_students.students.name.ilike.%${query}%,` +
        `class_students.classes.name.ilike.%${query}%,` +
        `class_labs.labs.code.ilike.%${query}%`
      );
    }

    const { data, count, error } = await requestQuery.range(from, to);

    if (error) {
      return { success: false, error: error.message };
    }

    const rows = (data || []).map((row: any) => {
      const student = row.class_students?.students;
      const cls = row.class_students?.classes;
      const lab = row.class_labs?.labs;

      return {
        id: row.id,
        student_id: student?.student_code || "",
        email: student?.email || "",
        name: student?.name || "",
        class_name: cls?.name || "",
        lab_id: lab?.code || "",
        drive_link: row.drive_link,
        note: row.note,
        admin_note: row.admin_note,
        status: row.status,
        completed_at: row.completed_at,
        completed_by: row.completed_by,
        updated_at: row.updated_at,
        created_at: row.created_at,
      };
    });

    const { count: pendingCount } = await supabaseServer
      .from("resubmission_requests_v2")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: approvedCount } = await supabaseServer
      .from("resubmission_requests_v2")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved");

    const { count: rejectedCount } = await supabaseServer
      .from("resubmission_requests_v2")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejected");

    const { count: completedCount } = await supabaseServer
      .from("resubmission_requests_v2")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed");

    return {
      success: true,
      data: rows,
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
      .from("resubmission_requests_v2")
      .update({
        status: status,
        admin_note: targetAdminNote,
        completed_at: new Date().toISOString(),
        completed_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", fromStatus)
      .select(`
        id,
        drive_link,
        note,
        admin_note,
        status,
        completed_at,
        completed_by,
        created_at,
        updated_at,
        class_students(
          students(email, student_code, name),
          classes(name)
        ),
        class_labs(
          labs(code)
        )
      `)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const student = (data as any).class_students?.students;
    const cls = (data as any).class_students?.classes;
    const lab = (data as any).class_labs?.labs;

    const mapped = {
      id: data.id,
      student_id: student?.student_code || "",
      email: student?.email || "",
      name: student?.name || "",
      class_name: cls?.name || "",
      lab_id: lab?.code || "",
      drive_link: data.drive_link,
      note: data.note,
      admin_note: data.admin_note,
      status: data.status,
      completed_at: data.completed_at,
      completed_by: data.completed_by,
      updated_at: data.updated_at,
      created_at: data.created_at,
    };

    return { success: true, data: mapped };
  } catch (err: unknown) {
    console.error("Error updating admin resubmission:", err);
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function getAdminDashboardStatsAction() {
  try {
    await requireAdmin();

    // 1. Get total counts
    const { count: studentCount, error: studentErr } = await supabaseServer
      .from("students")
      .select("email", { count: "exact", head: true });

    const { count: classCount, error: classErr } = await supabaseServer
      .from("classes")
      .select("id", { count: "exact", head: true });

    const { count: submissionCount, error: subErr } = await supabaseServer
      .from("submissions")
      .select("student_id", { count: "exact", head: true });

    const { count: pendingResubmissionCount, error: resubErr } = await supabaseServer
      .from("resubmission_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (studentErr || classErr || subErr || resubErr) {
      return {
        success: false,
        error: studentErr?.message || classErr?.message || subErr?.message || resubErr?.message
      };
    }

    // 2. Fetch class list
    const { data: classesData, error: classesFetchErr } = await supabaseServer
      .from("classes")
      .select("name");

    if (classesFetchErr) {
      return { success: false, error: classesFetchErr.message };
    }

    const classNames = Array.from(new Set((classesData || []).map((c) => c.name).filter(Boolean)));

    // Fetch submissions to calculate Pass/Fail
    const { data: submissionsData, error: subsFetchErr } = await supabaseServer
      .from("submissions")
      .select("class_name, score, status");

    if (subsFetchErr) {
      return { success: false, error: subsFetchErr.message };
    }

    const classStatsMap: Record<string, { pass: number; fail: number }> = {};
    classNames.forEach((name) => {
      classStatsMap[name] = { pass: 0, fail: 0 };
    });

    (submissionsData || []).forEach((sub) => {
      const clsName = sub.class_name;
      if (!clsName || !classStatsMap[clsName]) return;

      const score = Number(sub.score) || 0;
      const isPassed = sub.status?.toLowerCase() === "passed" || score >= 5;
      if (isPassed) {
        classStatsMap[clsName].pass += 1;
      } else {
        classStatsMap[clsName].fail += 1;
      }
    });

    const gradeDistribution = classNames.map((name) => ({
      name,
      pass: classStatsMap[name].pass,
      fail: classStatsMap[name].fail,
    }));

    // 3. Fetch recent resubmission requests
    const { data: recentResubmissions, error: recentResubErr } = await supabaseServer
      .from("resubmission_requests")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(5);

    if (recentResubErr) {
      return { success: false, error: recentResubErr.message };
    }

    // 4. Fetch recent submissions
    const { data: recentSubmissions, error: recentSubmitsErr } = await supabaseServer
      .from("submissions")
      .select("student_id, lab_id, class_name, score, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5);

    if (recentSubmitsErr) {
      return { success: false, error: recentSubmitsErr.message };
    }

    const studentCodes = Array.from(new Set((recentSubmissions || []).map((s) => s.student_id).filter(Boolean)));
    const studentNameMap: Record<string, string> = {};

    if (studentCodes.length > 0) {
      const { data: studentsData, error: studErr } = await supabaseServer
        .from("students")
        .select("student_code, name")
        .in("student_code", studentCodes);

      if (!studErr && studentsData) {
        studentsData.forEach((st) => {
          studentNameMap[st.student_code] = st.name || "";
        });
      }
    }

    const recentSubmissionsWithNames = (recentSubmissions || []).map((sub) => ({
      student_id: sub.student_id,
      student_name: studentNameMap[sub.student_id] || "Unknown",
      lab_id: sub.lab_id,
      class_name: sub.class_name,
      score: sub.score,
      status: mapSubmissionStatus(sub),
      updated_at: sub.updated_at,
    }));

    return {
      success: true,
      data: {
        metrics: {
          totalStudents: studentCount || 0,
          totalClasses: classCount || 0,
          totalSubmissions: submissionCount || 0,
          pendingResubmissions: pendingResubmissionCount || 0,
        },
        gradeDistribution,
        recentResubmissions: recentResubmissions || [],
        recentSubmissions: recentSubmissionsWithNames,
      }
    };
  } catch (err: unknown) {
    console.error("Error fetching dashboard statistics:", err);
    return { success: false, error: getErrorMessage(err) };
  }
}

