import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");

let supabaseUrl = "";
let supabaseKey = "";

envContent.split("\n").forEach(line => {
  const [key, val] = line.split("=");
  if (key && val) {
    const cleanKey = key.trim();
    const cleanVal = val.trim().replace(/['"]/g, "");
    if (cleanKey === "NEXT_PUBLIC_SUPABASE_URL") {
      supabaseUrl = cleanVal;
    } else if (cleanKey === "SUPABASE_SERVICE_ROLE_KEY") {
      supabaseKey = cleanVal;
    }
  }
});

async function run() {
  // 1. Query allowed_emails (Tất cả 37 dòng)
  const allowedRes = await fetch(
    `${supabaseUrl}/rest/v1/allowed_emails?select=email,student_id,class_name&order=student_id.asc`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const allowedList = await allowedRes.json();

  // 2. Query students join class_students (Tất cả 37 dòng)
  const studentsRes = await fetch(
    `${supabaseUrl}/rest/v1/students?select=email,student_code,class_students(classes(name))&order=student_code.asc`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const studentsList = await studentsRes.json();
  
  const formattedStudents = (studentsList || []).map(s => {
    const classes = s.class_students?.[0]?.classes;
    return {
      email: s.email,
      student_code: s.student_code,
      class_name: classes?.name || ""
    };
  });

  // Tìm sự khác biệt
  console.log(`Allowed emails count: ${allowedList.length}`);
  console.log(`Students (mapped) count: ${formattedStudents.length}`);

  const diff = [];
  allowedList.forEach(a => {
    const s = formattedStudents.find(x => x.email === a.email);
    if (!s) {
      diff.push({ email: a.email, problem: "Missing in students mapping" });
    } else if (s.student_code !== a.student_id || s.class_name !== a.class_name) {
      diff.push({
        email: a.email,
        allowed_mssv: a.student_id,
        allowed_class: a.class_name,
        student_mssv: s.student_code,
        student_class: s.class_name,
        problem: "Mismatch values"
      });
    }
  });

  console.log("\n=== Differences ===");
  if (diff.length === 0) {
    console.log("No differences found! The data matches 100%!");
  } else {
    console.table(diff);
  }
}

run().catch(console.error);
