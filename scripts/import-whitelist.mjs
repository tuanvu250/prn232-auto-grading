import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// 1. Tự động đọc và phân tích file cấu hình .env.local
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("Lỗi: Không tìm thấy file .env.local");
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      // Bỏ dấu ngoặc kép nếu có
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value.trim();
    }
  });
}

async function run() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "Lỗi: Vui lòng điền đầy đủ NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY vào file .env.local"
    );
    process.exit(1);
  }

  // Khởi tạo Supabase client sử dụng Service Role Key (để bypass RLS bảo mật khi import)
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 2. Đọc file CSV AllowedEmails
  const csvPath = path.resolve(process.cwd(), "docs/api/AllowedEmails - AllowedEmails.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`Lỗi: Không tìm thấy file CSV tại: ${csvPath}`);
    process.exit(1);
  }

  console.log("Đang đọc file CSV...");
  const csvContent = fs.readFileSync(csvPath, "utf8");

  // Tách dòng
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    console.log("File CSV rỗng hoặc chỉ có dòng tiêu đề.");
    return;
  }

  // Lấy dòng tiêu đề
  const headers = lines[0].split(",").map((h) => h.trim());
  const emailIdx = headers.indexOf("email");
  const mssvIdx = headers.indexOf("MSSV");
  const classIdx = headers.indexOf("Class");

  if (emailIdx === -1 || mssvIdx === -1 || classIdx === -1) {
    console.error(
      "Lỗi: Định dạng file CSV không đúng (Thiếu cột email, MSSV hoặc Class trong dòng đầu tiên)"
    );
    process.exit(1);
  }

  const records = [];

  // Duyệt qua từng dòng dữ liệu
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    // Bỏ qua dòng không đủ cột
    if (cols.length < Math.max(emailIdx, mssvIdx, classIdx) + 1) continue;

    records.push({
      email: cols[emailIdx].toLowerCase().trim(),
      student_id: cols[mssvIdx],
      class_name: cols[classIdx],
    });
  }

  console.log(`Đã đọc ${records.length} dòng dữ liệu sinh viên. Bắt đầu tải lên Supabase...`);

  // 3. Thực hiện Bulk Upsert lên Supabase (Ghi đè nếu trùng Email)
  const { error } = await supabase.from("allowed_emails").upsert(records, { onConflict: "email" });

  if (error) {
    console.error("Lỗi khi tải dữ liệu lên Supabase:", error.message);
    process.exit(1);
  }

  console.log("Chúc mừng! Đã import danh sách whitelist thành công lên Supabase.");
}

run();
