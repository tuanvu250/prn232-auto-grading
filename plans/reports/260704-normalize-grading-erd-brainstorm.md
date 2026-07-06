# Brainstorm: Chuẩn hóa ERD hệ thống xem điểm chấm PRN232

**Date:** 2026-07-04

## Ideas Explored

- **Thiết kế lại ERD từ đầu** — bị loại vì repo đã có sẵn một bản đề xuất (`docs/system-spec-vi.md` §3: TERMS → CLASSES → CLASS_STUDENTS ← STUDENTS, TERMS → LABS → CLASS_LABS, CLASS_LABS → SUBMISSION_VERSIONS, RESUBMISSION_REQUESTS với FK version) khớp gần như chính xác với yêu cầu của user. Không cần re-invent.
- **Giữ nguyên `submissions` (student_id, lab_id) làm PK và thêm cột `attempt_no`** — bị loại: vẫn phải đổi PK vì mỗi lần regrade hiện tại UPSERT đè điểm cũ, không giữ lịch sử. Đổi PK thực chất tương đương việc tách bảng `SUBMISSION_VERSIONS`.
- **Chỉ thêm bảng lịch sử riêng (audit log) mà giữ `submissions` overwrite như cũ** — bị loại: không giải quyết được yêu cầu breakdown điểm chi tiết (test case) theo từng version, vì `details jsonb` cũng bị đè theo `submissions`.
- **Migrate schema nhưng giữ dữ liệu cũ để nhập tay lại** — bị loại: dữ liệu điểm thật đang được dùng, user chọn migrate toàn bộ dữ liệu cũ sang schema mới thay vì bỏ.
- **Mở rộng luôn phạm vi cho Teacher role trong lần này** — bị loại: Teacher role hiện chỉ có route, chưa có nghiệp vụ; user chọn giữ ngoài phạm vi, tập trung Admin + Student.

## User's Direction

Áp dụng bản đề xuất ERD đã có sẵn trong `docs/system-spec-vi.md` §3 làm nền tảng, với 3 quyết định bổ sung:

1. **Sync tool ở repo `be` cũng nằm trong phạm vi** — phải đổi logic từ UPSERT (ghi đè `submissions`) sang INSERT một `SUBMISSION_VERSIONS` mới mỗi lần chấm/chấm lại.
2. **Migrate toàn bộ dữ liệu cũ** (`allowed_emails`, `submissions`, `resubmission_requests`) sang schema mới, không được mất lịch sử điểm đã có.
3. **Teacher ngoài phạm vi** lần này — chỉ thiết kế cho Admin và Student.
4. **Đập đi xây lại toàn bộ FE** (route/nav/component) theo đúng cấu trúc phân cấp kỳ → lớp → lab → version — không chắp vá lên cấu trúc trang cũ. Giữ nguyên hạ tầng auth/Supabase client/role-check và giữ nguyên UI/luồng resubmission request hiện có (chỉ đổi FK bên dưới, không redesign giao diện đó).
5. **Sửa business rule giới hạn regrade** — rule cũ "đã có 1 yêu cầu `approved` thì không được tạo yêu cầu mới" mâu thuẫn với mục tiêu đếm số lần chấm lại (luôn ra 0 hoặc 1 nếu giữ rule cũ). Rule mới: bỏ chặn theo trạng thái `approved`, thay bằng giới hạn cứng **tối đa 3 lần chấm lại** cho mỗi `(student, class_lab)`; lần yêu cầu thứ 4 bị chặn kèm cảnh báo. Rate limit hiện có (60s/thao tác, tối đa 5 thao tác pending/giờ) vẫn áp dụng trong phạm vi 3 lần đó.
6. **Cách đếm "số lần chấm lại"** — chốt là đếm số item thực sự được chấm với `item_type = 'resubmit'`, không tính các request bị admin reject.
7. **Tách `LABS` thành catalog toàn cục** — không gắn `term_id` vào `LABS` nữa (vd. có 10 lab trong catalog nhưng 1 kỳ chỉ chọn 3 lab để giao cho lớp). Việc "kỳ nào/lớp nào dùng lab nào" chuyển hẳn sang `CLASS_LABS`, vì hiện tại sinh viên chỉ nộp theo `lab_id` chứ chưa gắn theo lớp.
8. **Đổi mô hình submission từ version phẳng sang Order + OrderItem** — `SUBMISSIONS` đóng vai trò "order" (luôn mở, đúng 1 order/student/lab), `SUBMISSION_ITEMS` đóng vai trò "order item" (mỗi lần chấm là 1 item trong order). Học sinh xem order gắn với lab, kết quả từng lần chấm là item bên trong. Cách này giúp `RESUBMISSION_REQUESTS` chỉ cần trỏ vào `submission_id` thay vì lặp lại `student_id + class_lab_id`, và việc đếm/giới hạn số lần chấm lại (tối đa 3 item resubmit) trở nên tự nhiên hơn so với thiết kế version phẳng trước đó.

Yêu cầu nghiệp vụ cụ thể được xác nhận:
- Lab thuộc về 1 kỳ (`TERMS`), dùng chung cho tất cả lớp trong kỳ đó qua `CLASS_LABS` (deadline riêng theo lớp).
- Admin cần xem: kỳ → lớp → sinh viên → **breakdown số lần chấm lại theo từng sinh viên** (không phải tổng số của cả lớp).
- Student cần xem: lớp, kỳ, lab, điểm của **từng đợt chấm** (version) — bao gồm breakdown chi tiết theo test case, không chỉ điểm tổng + trạng thái.
- Mỗi lần regrade = sinh viên nộp link Drive mới → tạo `SUBMISSION_VERSIONS` mới, không ghi đè. Nghiệp vụ resubmission request + báo Discord đã tồn tại, không cần thiết kế lại — chỉ cần nối FK (`source_version_id`, `created_version_id`) đúng theo version thay vì string rời rạc.

## Open Questions

Các mục `/ck:plan` cần làm rõ khi lập kế hoạch triển khai chi tiết:

- Cách map dữ liệu cũ sang schema mới: `allowed_emails` → `STUDENTS` + `CLASS_STUDENTS` (cần suy ra `TERMS`/`CLASSES` từ `class_name` hiện có — có thể cần bảng mapping thủ công một lần vì `class_name` cũ không có `term_id`).
- `lab_id` hiện tại không nhất quán format (có chỗ dùng tên đầy đủ, có chỗ dùng `"lab2"` viết thường) — cần quy tắc chuẩn hóa `lab_code` trước khi map sang `LABS.id`.
- Vì sync tool ở repo `be` (repo khác) cũng cần sửa, cần xác định: 2 repo có tách deploy độc lập không, và thứ tự rollout (schema trước hay sync tool trước) để tránh downtime/mất dữ liệu chấm trong lúc chuyển đổi.
- Cách admin xem "breakdown số lần chấm lại theo từng sinh viên" — cần quyết định là SQL view/aggregate hay tính trong application code (hiện tại code đang tính bằng JS Map, nên cân nhắc dùng SQL view để tránh lặp lại vấn đề N+1 query đã có).

## Risks

- **Rủi ro migrate dữ liệu**: `submissions` hiện tại PK `(student_id, lab_id)` chỉ giữ bản ghi mới nhất — không có cách khôi phục lịch sử các lần chấm trước đó đã bị ghi đè trong quá khứ. Dữ liệu cũ chỉ map được thành 1 `SUBMISSION_VERSIONS` (version cuối), không tái tạo được các version trước đó.
- **Rủi ro phối hợp 2 repo**: sửa sync tool ở repo `be` yêu cầu đổi hợp đồng API/DB giữa 2 repo — nếu không đồng bộ thời điểm deploy, tool cũ có thể tiếp tục UPSERT vào schema mới sai cách (ví dụ ghi đè `SUBMISSION_VERSIONS` thay vì insert).
- **Rủi ro tính nhất quán `class_name`/`lab_id`**: chuẩn hóa string tự do thành FK đòi hỏi dữ liệu hiện tại phải sạch (không có lỗi chính tả/khác biệt viết hoa-thường) — cần bước validate/cleanup trước khi tạo FK constraint.
