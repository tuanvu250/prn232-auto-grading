# Phase 5: Rebuild FE admin dashboard

## Requirements

Đập bỏ trang admin hiện tại (picker lớp+lab rời rạc dựa vào chuỗi) và xây lại theo đúng phân cấp dữ liệu mới: chọn kỳ → chọn lớp → chọn lab của lớp → thấy danh sách sinh viên kèm số lần chấm lại, tất cả trong 1 lượt tải trang không cần lọc thủ công nhiều lần.

Map tới user story: [P1] admin browse term→class→student, [P1] admin quản lý lab catalog + gán cho lớp, [P1] admin xem breakdown số lần chấm lại per student, [P1] admin nav theo term→class→lab→student.

## Steps

1. Thiết kế lại điều hướng admin theo 4 cấp: danh sách kỳ học, danh sách lớp trong kỳ, danh sách lab đã gán cho lớp, danh sách sinh viên của lớp cho lab đó.
2. Xây trang quản lý catalog lab: tạo lab mới độc lập với kỳ học, và trang gán lab cho 1 lớp cụ thể kèm deadline riêng.
3. Xây truy vấn tổng hợp 1 lượt cho trang "sinh viên + số lần chấm lại": lấy dòng `SUBMISSIONS` có `attempt_no` cao nhất mỗi `(class_student_id, class_lab_id)` làm điểm hiển thị chính, cộng cột đếm số dòng `item_type = 'resubmit'`, dùng 1 câu truy vấn có gộp nhóm thay vì gọi lặp lại nhiều lần.
4. Cập nhật cách xác định "lab nào chưa nộp": nối trực tiếp danh sách lab đã giao cho lớp với các dòng `SUBMISSIONS` của từng sinh viên (theo `class_lab_id`), không còn so sánh 2 danh sách rời rạc trên trình duyệt.
5. Thay thế toàn bộ trang/route admin cũ dựa vào tên lớp/lab dạng chuỗi bằng route mới dựa trên id lớp/lab thật.
6. Tái sử dụng nguyên trạng hạ tầng xác thực/role-check/Supabase client hiện có — chỉ viết lại phần truy vấn dữ liệu và giao diện hiển thị.
7. Kiểm thử thủ công toàn bộ luồng admin: chọn kỳ, chọn lớp, chọn lab, xem danh sách sinh viên kèm số lần chấm lại đúng với dữ liệu đã migrate.

## Success Criteria

- Admin mở dashboard, đi qua đủ 4 cấp kỳ → lớp → lab → sinh viên mà không cần nhập tay tên lớp/lab.
- Trang danh sách sinh viên hiển thị đúng điểm ở `attempt_no` cao nhất và số lần chấm lại thực tế, khớp với dữ liệu đã migrate, chỉ bằng 1 lượt tải trang.
- Không còn trang/route admin nào phụ thuộc vào so khớp chuỗi tên lớp hoặc mã lab.
- Trang gán lab cho lớp hoạt động: gán 1 lab từ catalog cho 1 lớp với deadline riêng, xác nhận lưu đúng.

## Risks

- Truy vấn tổng hợp mới thiết kế sai gây chậm hoặc sai số đếm chấm lại: kiểm thử với dữ liệu lớp có nhiều sinh viên/nhiều lượt chấm trước khi coi là xong.
- Đập bỏ route cũ quá sớm trước khi route mới ổn định, gây gián đoạn cho admin đang dùng: dùng banner bảo trì ngắn trong lúc rebuild thay vì để trang lỗi âm thầm.
