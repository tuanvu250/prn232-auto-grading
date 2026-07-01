// Google Apps Script - Google Sheets DB Integration for PRN232 Auto Grading System
// Deploy as a Web App: Execute as "Me", Access: "Anyone"

const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE"; 

function getSheetByName(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Initialize headers if sheet is newly created
    if (name === "Students") {
      sheet.appendRow(["email", "name", "student_id", "class", "created_at"]);
    } else if (name === "Submissions") {
      sheet.appendRow(["submission_id", "email", "lab_id", "score", "status", "details", "submitted_at"]);
    } else if (name === "AllowedEmails") {
      sheet.appendRow(["email"]);
    }
  }
  return sheet;
}

// Check if an email is in the AllowedEmails whitelist
function isEmailAllowed(email) {
  const sheet = getSheetByName("AllowedEmails");
  const data = sheet.getDataRange().getValues();
  
  // If the sheet has no emails other than header, allow all (or default behaviour)
  if (data.length <= 1) {
    return { allowed: true, studentId: "", className: "" }; 
  }
  
  const emailToCheck = email.toLowerCase().trim();
  
  // Start from index 1 to skip headers
  for (let i = 1; i < data.length; i++) {
    const rowEmail = data[i][0].toString().toLowerCase().trim();
    if (rowEmail === emailToCheck) {
      // Column B (index 1) is MSSV / Student ID
      const studentId = data[i][1] ? data[i][1].toString().trim() : "";
      // Column C (index 2) is Class / Class Name
      const className = data[i][2] ? data[i][2].toString().trim() : "";
      return { allowed: true, studentId: studentId, className: className };
    }
  }
  return { allowed: false, studentId: "", className: "" };
}

// GET Requests - Used for checking email authorization and retrieving grades
function doGet(e) {
  try {
    const action = e.parameter.action;
    const email = e.parameter.email;
    
    if (action === "checkEmail") {
      if (!email) {
        return createResponse({ success: false, error: "Missing email parameter" });
      }
      const result = isEmailAllowed(email);
      return createResponse({ 
        success: true, 
        allowed: result.allowed, 
        studentId: result.studentId,
        className: result.className
      });
    }
    
    // Đọc điểm nộp bài từ sheet Submissions dựa trên email
    if (action === "getGrades") {
      if (!email) {
        return createResponse({ success: false, error: "Missing email parameter" });
      }
      
      const sheet = getSheetByName("Submissions");
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const studentGrades = [];
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[1] === email) { // Column B: email
          const gradeObj = {};
          headers.forEach((header, index) => {
            gradeObj[header] = row[index];
          });
          studentGrades.push(gradeObj);
        }
      }
      
      return createResponse({ success: true, data: studentGrades });
    }

    // Đọc điểm chi tiết của sinh viên từ sheet bảng điểm lớp học (ví dụ: "SE1815")
    // API tự động liên kết email đăng nhập sang MSSV để so khớp điểm
    if (action === "getStudentClassGrades") {
      if (!email) {
        return createResponse({ success: false, error: "Missing email parameter" });
      }

      // 1. Tìm MSSV và Lớp học của email này từ AllowedEmails
      const checkResult = isEmailAllowed(email);
      if (!checkResult.allowed || !checkResult.studentId) {
        return createResponse({ success: false, error: "Email không được phép truy cập hoặc không tìm thấy thông tin sinh viên." });
      }
      
      const studentId = checkResult.studentId;
      // Lấy tên lớp từ param nếu có, nếu không tự động lấy className từ sheet AllowedEmails
      const className = e.parameter.class || checkResult.className;

      if (!className) {
        return createResponse({ success: false, error: "Không tìm thấy thông tin lớp học của sinh viên." });
      }

      // 2. Tìm điểm trong sheet lớp học
      const sheet = getSheetByName(className);
      if (!sheet) {
        return createResponse({ success: false, error: "Không tìm thấy bảng điểm lớp: " + className });
      }
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      let studentGrade = null;
      
      // Xác định cột chứa MSSV trong sheet lớp học
      let mssvColIndex = headers.findIndex(h => h.toString().toUpperCase().trim() === "MSSV");
      if (mssvColIndex === -1) mssvColIndex = 1; // Mặc định cột B nếu không tìm thấy header "MSSV"
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowMssv = row[mssvColIndex] ? row[mssvColIndex].toString().trim().toUpperCase() : "";
        
        if (rowMssv === studentId.toUpperCase()) {
          studentGrade = {};
          headers.forEach((header, index) => {
            let cleanHeader = header.toString().trim();
            // Chuẩn hóa tiêu đề cột
            if (cleanHeader.includes("Tn") || cleanHeader.includes("Tên")) {
              cleanHeader = "name";
            }
            studentGrade[cleanHeader] = row[index];
          });
          break;
        }
      }
      
      if (!studentGrade) {
        return createResponse({ success: true, found: false, error: "Không tìm thấy điểm của sinh viên mang MSSV: " + studentId });
      }
      
      return createResponse({ success: true, found: true, data: studentGrade });
    }
    
    return createResponse({ success: false, error: "Invalid action" });
  } catch (error) {
    return createResponse({ success: false, error: error.toString() });
  }
}


// POST Requests - Used for syncing user info and saving test results
// Next.js should send requests as "text/plain" content-type to avoid CORS preflight options issues
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    // 1. Sync User info when logging in
    if (action === "syncUser") {
      const { email, name, student_id, class_name } = postData.data;
      
      // Enforce whitelist check on login
      const checkResult = isEmailAllowed(email);
      if (!checkResult.allowed) {
        return createResponse({ 
          success: false, 
          error: "UNAUTHORIZED_EMAIL", 
          message: "Email của bạn không nằm trong danh sách lớp học được cấp phép." 
        });
      }

      const finalStudentId = student_id || checkResult.studentId;
      const finalClassName = class_name || checkResult.className;
      const sheet = getSheetByName("Students");
      const data = sheet.getDataRange().getValues();
      let userRowIndex = -1;

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === email) { // Column A: email
          userRowIndex = i + 1;
          break;
        }
      }

      const now = new Date().toISOString();
      if (userRowIndex === -1) {
        sheet.appendRow([email, name, finalStudentId || "", finalClassName || "", now]);
      } else {
        sheet.getRange(userRowIndex, 2).setValue(name); // Update name
        if (finalStudentId) sheet.getRange(userRowIndex, 3).setValue(finalStudentId);
        if (finalClassName) sheet.getRange(userRowIndex, 4).setValue(finalClassName);
      }
      return createResponse({ success: true, message: "User synced successfully" });
    }

    // 2. Save auto-grading test results
    if (action === "saveSubmission") {
      const { email, lab_id, score, status, details } = postData.data;
      const sheet = getSheetByName("Submissions");
      
      const submissionId = "SUB_" + Utilities.getUuid().substring(0, 8).toUpperCase();
      const now = new Date().toISOString();
      const detailsStr = typeof details === "object" ? JSON.stringify(details) : details;

      sheet.appendRow([
        submissionId, 
        email, 
        lab_id, 
        score, 
        status, 
        detailsStr || "", 
        now
      ]);

      return createResponse({ 
        success: true, 
        data: { submission_id: submissionId, submitted_at: now } 
      });
    }

    return createResponse({ success: false, error: "Invalid action" });
  } catch (error) {
    return createResponse({ success: false, error: error.toString() });
  }
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
