# Phase 6: Rebuild FE student dashboard + rewiring resubmission-request dialog

## Requirements

Đập bỏ trang sinh viên hiện tại (hiển thị 1 điểm duy nhất mỗi lab) và xây lại theo luồng lab → danh sách dòng `SUBMISSIONS` (theo `attempt_no`) → chi tiết 1 dòng, đồng thời nối lại dialog yêu cầu chấm lại vào FK mới với giới hạn 3 lần và bắt buộc chọn đúng lab.

Map tới user story: [P1] student xem toàn bộ lịch sử điểm, [P1] student xem chi tiết breakdown từng lần chấm, [P1] student nav lab→danh sách lần chấm→chi tiết, [P1] student chọn đúng 1 lab khi tạo request chấm lại (không suy luận mặc định), [P1] student giới hạn 3 lần chấm lại kèm cảnh báo khi chạm giới hạn.

## Steps

1. Thiết kế lại điều hướng sinh viên: danh sách lab đã giao cho lớp mình, chọn 1 lab để xem toàn bộ dòng `SUBMISSIONS` của mình cho `(class_student_id, class_lab_id)` đó, sắp xếp theo `attempt_no` tăng dần.
2. Xây trang chi tiết 1 dòng `SUBMISSIONS` cụ thể: hiển thị đúng breakdown (test case, log, kết quả) của riêng dòng đó, không lẫn với các `attempt_no` khác.
3. Cập nhật cách xác định "lab chưa nộp": nối trực tiếp lab đã giao cho lớp của sinh viên với các dòng `SUBMISSIONS` của chính họ (theo `class_lab_id`), không còn so sánh 2 danh sách trên trình duyệt.
4. Sửa dialog yêu cầu chấm lại: bắt buộc sinh viên chọn đúng 1 lab cụ thể trong số lab đang hoạt động của lớp mình khi có nhiều hơn 1 lab, không tự chọn mặc định theo lab đang xem hay lab gần nhất.
5. Cập nhật server action tạo yêu cầu chấm lại: xác nhận lab được chọn đúng thuộc lớp của sinh viên, xác nhận đã có ít nhất 1 dòng `SUBMISSIONS` cho `(class_student_id, class_lab_id)` đó (chặn và báo lỗi rõ ràng nếu chưa từng nộp), rồi mới tạo yêu cầu trỏ vào đúng `submission_id` liên quan.
6. Thêm kiểm tra giới hạn 3 lần chấm lại mỗi `(class_student_id, class_lab_id)`: ở lần yêu cầu thứ 4, chặn tạo yêu cầu mới và hiển thị cảnh báo đã đạt giới hạn, giữ nguyên rate-limit hiện có (60 giây/thao tác, tối đa 5 thao tác đang chờ mỗi giờ). Server action gọi trực tiếp RPC đếm-và-tạo yêu cầu chấm lại chuyên dụng đã dựng ở Phase 1 bước 7 (không tự đếm rồi insert rời rạc ở tầng application) — RPC này tính tổng cả request đang `pending`/`approved` lẫn dòng `SUBMISSIONS.item_type='resubmit'` đã hoàn tất, nên 2 request gần như đồng thời không thể cùng vượt qua kiểm tra đếm, và học sinh không thể lách giới hạn bằng cách tạo nhiều request `pending` cùng lúc.
7. Giữ nguyên toàn bộ giao diện, luồng nghiệp vụ, và tích hợp Discord webhook hiện có của dialog yêu cầu chấm lại — chỉ thay đổi cách xác định lab/dòng `SUBMISSIONS` bên dưới.
8. Kiểm thử thủ công toàn bộ luồng sinh viên: xem lịch sử điểm nhiều lần chấm, mở chi tiết 1 dòng, gửi yêu cầu chấm lại đúng lab, gửi đến lần thứ 4 để xác nhận bị chặn đúng như mong đợi.

## Success Criteria

- Sinh viên mở 1 lab, thấy toàn bộ dòng `SUBMISSIONS` của mình theo `attempt_no` tăng dần, không chỉ điểm mới nhất.
- Mở 1 dòng cụ thể hiển thị đúng breakdown của dòng đó, không lẫn dữ liệu giữa các `attempt_no`.
- Dialog yêu cầu chấm lại bắt buộc chọn lab khi lớp có nhiều hơn 1 lab đang hoạt động, không có lựa chọn mặc định ngầm.
- Gửi yêu cầu chấm lại lần thứ 4 cho cùng 1 lab bị chặn, hiển thị cảnh báo rõ ràng, không tạo thêm dòng `SUBMISSIONS` hoặc yêu cầu mới.
- Gửi yêu cầu cho lab chưa từng có bài nộp bị chặn với thông báo phù hợp thay vì tạo yêu cầu rỗng.

## Risks

- Sửa server action giới hạn 3 lần bị nhầm lẫn với rate-limit thời gian hiện có, gây chặn sai hoặc không chặn đúng lúc: viết rõ 2 điều kiện tách biệt (giới hạn 3 lần theo lịch sử vs rate-limit theo thời gian) và kiểm thử từng điều kiện riêng.
- Đổi FK bên dưới dialog nhưng vô tình đổi luôn giao diện/luồng đã quy định giữ nguyên: review diff kỹ, chỉ chạm vào phần data-fetching/validate, không đổi component UI.
