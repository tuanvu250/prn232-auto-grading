# Phase 4: RLS policies mới

## Requirements

Khai báo lại Row Level Security tường minh cho toàn bộ bảng mới, đặc biệt bảng `SUBMISSIONS` phẳng, để sinh viên chỉ đọc được dữ liệu của chính mình và admin vẫn đọc/ghi được toàn bộ như trước — không được thừa hưởng ngầm rule cũ của bảng `submissions`.

Map tới user story: nền tảng bảo mật cho toàn bộ [P1] student xem các lần chấm của mình, [P1] admin xem breakdown per student — đảm bảo đúng người xem đúng dữ liệu.

## Steps

1. Rà lại pattern xác thực JWT hiện có (claim nào định danh sinh viên) đang dùng cho bảng cũ, để áp dụng lại đúng cách cho bảng mới.
2. Viết policy cho bảng `SUBMISSIONS`: sinh viên chỉ đọc được các dòng có `class_student_id` join tới đúng danh tính đăng nhập của mình; admin đọc/ghi được tất cả.
3. Viết/rà soát lại policy cho các bảng còn lại liên quan (sinh viên, quan hệ sinh viên–lớp, lab-theo-lớp, yêu cầu chấm lại) để đảm bảo nhất quán với mô hình quyền mới.
4. Viết một bộ kiểm thử thủ công theo từng vai trò (sinh viên A, sinh viên B, admin) xác nhận: sinh viên A không đọc được dữ liệu của sinh viên B, admin đọc được tất cả.
5. Bật RLS chính thức trên các bảng mới sau khi kiểm thử qua, trước khi cho phép FE mới (Phase 5/6) truy cập dữ liệu thật.

## Success Criteria

- Sinh viên đăng nhập chỉ truy vấn được các dòng `SUBMISSIONS` của chính mình, không truy vấn được của sinh viên khác dù biết id.
- Admin vẫn đọc/ghi được toàn bộ dữ liệu như luồng hiện tại, không bị RLS mới chặn nhầm.
- Toàn bộ bảng mới (`SUBMISSIONS`, sinh viên, quan hệ lớp, lab-theo-lớp, yêu cầu chấm lại) đều có policy khai báo rõ ràng, không bảng nào bị bỏ sót.

## Rollback

Nếu sau khi enable RLS mà admin/student dashboard bị lỗi truy cập (policy quá chặt hoặc quá lỏng) phát hiện ở Phase 5/6 hoặc trên production thật: disable RLS ngay trên bảng bị ảnh hưởng (`ALTER TABLE ... DISABLE ROW LEVEL SECURITY`), sửa lại policy, chạy lại bộ test theo từng vai trò (bước 4) trước khi enable lại — không cần redeploy code ứng dụng, chỉ cần chạy lại SQL policy.

## Risks

- Policy viết thiếu điều kiện join đúng khiến sinh viên đọc lẫn dữ liệu của nhau: kiểm thử thủ công theo từng vai trò trước khi bật RLS chính thức trên production.
- RLS quá chặt khiến admin dashboard (Phase 5) không đọc được dữ liệu, phải quay lại sửa giữa chừng: xác nhận policy admin hoạt động đúng trước khi bắt đầu Phase 5.
