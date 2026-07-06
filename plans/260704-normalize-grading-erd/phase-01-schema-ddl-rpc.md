# Phase 1: Schema DDL + RPC

## Requirements

Đưa toàn bộ mô hình dữ liệu chuẩn hóa mới (kỳ → lớp → sinh viên, catalog lab → lab-theo-lớp, bảng `SUBMISSIONS` phẳng cho từng lần chấm) vào Supabase, cùng với 1 cơ chế an toàn để đánh số thứ tự lần chấm (`attempt_no`) không bị trùng khi có 2 lần chấm chạy gần nhau. Không có bảng "order" trung gian — `SUBMISSIONS` FK trực tiếp vào `CLASS_STUDENTS` + `CLASS_LABS`. Không đụng vào dữ liệu cũ ở phase này — chỉ tạo cấu trúc bảng mới song song.

Map tới user story: [P1] admin browse term→class→student, [P1] admin quản lý lab catalog + gán cho lớp, [P1] student chọn đúng lab khi tạo request (nền tảng FK cho FR-18).

## Steps

1. Tạo các bảng mô tả kỳ học, lớp học, và catalog lab dùng chung nhiều kỳ — đảm bảo lab không bị buộc cứng vào 1 kỳ cụ thể.
2. Tạo bảng gán "lớp này dùng lab nào, deadline riêng ra sao" — đây là nơi duy nhất quyết định lab nào áp dụng cho lớp/kỳ nào.
3. Tạo bảng sinh viên thật và quan hệ sinh viên–lớp (`CLASS_STUDENTS`), thay cho danh sách email cho phép hiện tại.
4. Tạo bảng `SUBMISSIONS` phẳng: FK `class_student_id` → `CLASS_STUDENTS`, FK `class_lab_id` → `CLASS_LABS`, cột `attempt_no` (số thứ tự tăng dần trong phạm vi `(class_student_id, class_lab_id)`), `item_type` (`original`/`late`/`resubmit`), `source_url`, `score`, `status`, `details jsonb`, `submitted_at`, `graded_at`. Ràng buộc chống trùng `UNIQUE(class_student_id, class_lab_id, attempt_no)`. Cột `status` phải được tính riêng cho từng dòng theo ngưỡng điểm ≥ 5.0 (đạt/không đạt) — không suy ra từ dòng mới nhất của cùng sinh viên+lab. Không tạo bảng "order"/"item" tách rời — mỗi lần chấm là 1 dòng độc lập ngay trong bảng này.
5. Xây dựng RPC function `SECURITY DEFINER` sinh `attempt_no` an toàn khi nhiều tiến trình chấm cùng lúc: dùng Postgres advisory lock khóa theo hash của `(class_student_id, class_lab_id)` (không dùng row lock, vì có thể chưa tồn tại dòng `SUBMISSIONS` nào để lock ở lần nộp đầu tiên) — trong cùng transaction, tính `attempt_no = COALESCE(MAX(attempt_no), 0) + 1`, tính `status` theo ngưỡng ≥ 5.0, rồi INSERT dòng `SUBMISSIONS` mới. `UNIQUE(class_student_id, class_lab_id, attempt_no)` là lưới an toàn phụ nếu advisory lock bị bypass.
6. Cập nhật bảng yêu cầu chấm lại để trỏ thẳng vào `submission_id` (dòng dẫn tới yêu cầu) và `created_submission_id` (dòng được tạo sau khi request hoàn tất, nullable) — thay vì các cột chuỗi rời rạc như tên lớp/lab hiện tại, đồng thời bỏ luật cũ "đã từng được duyệt thì không tạo yêu cầu mới". Giới hạn tối đa 3 lần chấm lại mỗi `(class_student_id, class_lab_id)` được tính trên tổng số dòng `RESUBMISSION_REQUESTS` đang `pending`/`approved` **và chưa được fulfill** (`created_submission_id is null`) cộng số dòng `SUBMISSIONS` với `item_type = 'resubmit'` đã có — không chỉ đếm riêng dòng `resubmit` đã hoàn tất (để tránh học sinh tạo nhiều request `pending` cùng lúc rồi vượt trần khi chúng lần lượt được duyệt), và loại trừ request đã fulfill khỏi vế đầu (để tránh đếm trùng 1 lần chấm lại vừa là "request đang mở" vừa là "dòng resubmit" sau khi RPC sinh `attempt_no` đã set `created_submission_id`).
7. Xây dựng thêm 1 RPC function `SECURITY DEFINER` thứ hai dùng riêng cho việc tạo yêu cầu chấm lại: dùng cùng cơ chế advisory lock trên `(class_student_id, class_lab_id)` như RPC ở bước 5, trong cùng transaction đếm tổng số request/`resubmit` hiện có theo quy tắc ở bước 6, nếu chưa đạt giới hạn 3 thì mới INSERT dòng `RESUBMISSION_REQUESTS` mới — đảm bảo đếm-rồi-tạo là 1 thao tác nguyên tử, không tách rời ở tầng application (dùng bởi Phase 6).
8. Khi tool chấm bên `be` (Phase 3) tạo 1 dòng `SUBMISSIONS` mới với `item_type = 'resubmit'` để hoàn tất 1 yêu cầu chấm lại đang chờ, RPC sinh `attempt_no` ở bước 5 phải nhận thêm tham số tùy chọn `fulfills_request_id` — nếu có, sau khi INSERT dòng `SUBMISSIONS` thành công, cùng trong transaction đó cập nhật `RESUBMISSION_REQUESTS.created_submission_id` của đúng request đó trỏ về dòng vừa tạo. Đây là nơi duy nhất ghi giá trị cho `created_submission_id`.
9. Viết tài liệu ngắn mô tả cách gọi 2 RPC này từ bên ngoài (để repo `be` — ngôn ngữ khác — có thể gọi được), ghi rõ input/output của từng RPC, bao gồm tham số `fulfills_request_id` tùy chọn ở RPC sinh `attempt_no`.
10. Chạy thử tạo dữ liệu mẫu (1 kỳ, 1 lớp, 1 lab, 1 sinh viên, 2 lần chấm liên tiếp gọi RPC, 1 lần tạo yêu cầu chấm lại qua RPC ở bước 7, 1 lần chấm bổ sung qua RPC ở bước 5 với `fulfills_request_id` trỏ đúng request đó) để xác nhận toàn bộ ràng buộc, cơ chế chống trùng, và việc ghi `created_submission_id` hoạt động đúng trước khi chuyển sang migration dữ liệu thật.

## Success Criteria

- Toàn bộ bảng mới tồn tại trên Supabase với khóa ngoại vật lý đầy đủ giữa các bảng liên quan, không quan hệ logic qua chuỗi.
- Chạy thử 2 lần chấm liên tiếp cho cùng `(class_student_id, class_lab_id)` qua RPC tạo ra 2 dòng `SUBMISSIONS` phân biệt (`attempt_no` = 1, 2), không ghi đè, không trùng `attempt_no` dù chạy đồng thời; mỗi dòng có `status` tính đúng theo điểm riêng của dòng đó (không lấy theo dòng mới nhất).
- RPC tạo yêu cầu chấm lại (bước 7) cho phép tạo yêu cầu thứ 2, 3, và chặn đúng ở yêu cầu thứ 4 cho cùng `(class_student_id, class_lab_id)`, tính đúng cả request đang `pending`/`approved` lẫn `SUBMISSIONS.item_type='resubmit'` đã hoàn tất trong tổng số đếm — kiểm thử ở phase này ở mức RPC/SQL, UI-level enforcement (dialog cảnh báo) là việc của Phase 6.
- RPC sinh `attempt_no` với tham số `fulfills_request_id` ghi đúng `RESUBMISSION_REQUESTS.created_submission_id` khi được gọi để hoàn tất 1 yêu cầu chấm lại.
- Không có bảng/dữ liệu cũ (`allowed_emails`, `submissions`, `resubmission_requests` hiện tại) bị xóa hoặc thay đổi ở phase này.

## Risks

- Thiết kế khóa ngoại sai khiến phase migration sau phải sửa lại DDL giữa chừng: viết dữ liệu mẫu thử nghiệm đầy đủ các quan hệ trước khi coi phase này là xong.
- RPC sinh `attempt_no` không thực sự nguyên tử dưới tải đồng thời thật (vd. advisory lock bị release sớm do lỗi transaction): bổ sung ràng buộc `UNIQUE(class_student_id, class_lab_id, attempt_no)` làm lưới an toàn độc lập với logic khóa.
- Advisory lock key bị trùng do hash collision giữa 2 cặp `(class_student_id, class_lab_id)` khác nhau: dùng hàm hash 2 tham số riêng của Postgres (`hashtextextended` hoặc kết hợp 2 số nguyên qua `pg_advisory_xact_lock(key1, key2)` với 2 khóa 32-bit tách biệt) thay vì hash 1 chuỗi ghép, giảm nguy cơ va chạm.
