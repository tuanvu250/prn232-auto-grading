# Phase 3: Sync tool ở repo `be` — chuyển sang append-only, redeploy, resume

## Requirements

Cập nhật tool chấm bài ở repo riêng biệt `/Users/ngothanhdat/Documents/CODE/prn232/prn232-auto-grader/be` (.NET, không cùng CI/CD với repo này) để mỗi lần chấm gọi RPC tạo thêm 1 dòng `SUBMISSIONS` mới (`attempt_no` kế tiếp) cho `(class_student_id, class_lab_id)` của sinh viên, thay vì ghi đè điểm cũ. Sau khi deploy xong, mở lại cho tool này chạy tiếp trên schema mới.

**Lưu ý quan trọng:** Toàn bộ công việc code trong phase này nằm ở repo `be` (đường dẫn tuyệt đối: `/Users/ngothanhdat/Documents/CODE/prn232/prn232-auto-grader/be`), KHÔNG nằm trong cùng PR/commit với repo hiện tại (`prn232-auto-grading`). Cần theo dõi và deploy riêng theo lịch của repo đó.

Map tới user story: [P1] as the grading tool in `be`, tôi muốn thêm 1 dòng `SUBMISSIONS` mới mỗi lần chấm thay vì ghi đè điểm cũ.

## Steps

1. Ở repo `be`, xác định lại logic ghi điểm hiện tại đang tìm-và-ghi-đè theo (sinh viên, mã lab) — thay bằng logic gọi trực tiếp RPC sinh `attempt_no` (đã dựng ở Phase 1) theo `(class_student_id, class_lab_id)`, không cần bước tìm-hoặc-tạo bảng trung gian nào vì không còn bảng "đơn" — mỗi lần chấm luôn tạo thẳng 1 dòng `SUBMISSIONS` mới. Khi lượt chấm này là để hoàn tất 1 yêu cầu chấm lại đang `approved`/`pending` (không phải lượt chấm gốc đầu tiên), tool phải truyền kèm tham số `fulfills_request_id` (id của `RESUBMISSION_REQUESTS` tương ứng) trong lời gọi RPC, để RPC tự động cập nhật `RESUBMISSION_REQUESTS.created_submission_id` — không tự ghi cột này trực tiếp từ code `be`.
2. Cập nhật cấu hình kết nối của tool để trỏ đúng bảng/RPC mới, loại bỏ hoàn toàn code UPSERT theo cặp cũ.
3. Kiểm thử tool trên môi trường staging: chấm 1 sinh viên 2 lần liên tiếp cho cùng 1 lab, xác nhận tạo ra 2 dòng `SUBMISSIONS` riêng biệt (`attempt_no` = 1, 2).
4. Deploy bản cập nhật của tool lên môi trường production theo quy trình riêng của repo `be`.
5. Sau khi xác nhận deploy thành công và chạy ổn định, thông báo cho người phụ trách để chính thức cho phép tool tiếp tục xử lý luồng chấm bài bình thường trên schema mới (kết thúc giai đoạn tạm dừng ở Phase 2).
6. Theo dõi một vòng chấm bài thật đầu tiên sau khi resume để xác nhận không có lỗi ghi dữ liệu hoặc trùng lặp phát sinh.

## Success Criteria

- Repo `be` không còn đoạn code nào UPSERT trực tiếp theo (sinh viên, mã lab) cũ.
- Chấm lại 1 sinh viên 2 lần liên tiếp trên production tạo ra 2 dòng `SUBMISSIONS` phân biệt (`attempt_no` khác nhau), không ghi đè.
- Có xác nhận rõ ràng (thời điểm, người xác nhận) rằng tool đã được resume và đang chạy ổn định trên schema mới.
- Không phát sinh lỗi ràng buộc trùng `attempt_no` trong vòng theo dõi đầu tiên sau resume.

## Risks

- Repo `be` có lịch deploy/quy trình riêng biệt, có thể trễ so với migration schema — Mitigation: giữ trạng thái tạm dừng sync tool cho đến khi có xác nhận deploy thành công, không resume sớm.
- Logic .NET gọi RPC sinh `attempt_no` sai cách (không đúng retry/timeout khi advisory lock đang giữ bởi tiến trình khác) gây trùng lặp hoặc lỗi — Mitigation: kiểm thử kỹ trên staging với nhiều lượt chấm gần nhau trước khi deploy production.
- Thiếu người xác nhận rõ ràng cho bước resume dẫn đến tool bị bỏ quên ở trạng thái tạm dừng — Mitigation: ghi rõ tên người phụ trách và kênh xác nhận (vd. tin nhắn/ticket) trước khi coi phase này là hoàn tất.
