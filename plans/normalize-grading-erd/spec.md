# Spec: Chuẩn hóa ERD hệ thống xem điểm chấm PRN232

**Date:** 2026-07-04
**Status:** Draft

---

## Problem Statement

Repo này hiển thị điểm chấm lab (đồng bộ từ repo `be`) cho admin và sinh viên, nhưng schema hiện tại (`allowed_emails`, `submissions`, `resubmission_requests`) không chuẩn hóa: không có bảng `TERMS`/`CLASSES`/`LABS`, không có FK vật lý, sinh viên hiện chỉ nộp bài gắn theo `lab_id` chứ không gắn theo lớp, và mỗi lần chấm lại **ghi đè** (UPSERT) điểm cũ thay vì lưu lịch sử. Vì vậy admin không thể xem đúng cấu trúc kỳ → lớp → sinh viên → số lần chấm lại, và sinh viên không thể xem điểm của từng đợt chấm trước đó.

Vì schema hiện tại không chuẩn, phần FE hiển thị điểm (routes, components, data-fetching) cũng được phép **đập đi xây lại toàn bộ** để phản ánh đúng cấu trúc phân cấp kỳ → lớp → lab → order → kết quả từng lần chấm, thay vì cố gắng chắp vá lên cấu trúc trang cũ vốn được thiết kế quanh model overwrite-only. Hạ tầng auth/Supabase client/role-check hiện có (đang hoạt động tốt) được giữ nguyên, không rebuild.

---

## Mô hình dữ liệu cốt lõi (đã chốt qua brainstorm, sửa lại ngày 2026-07-04)

- **Lab là catalog toàn cục, không gắn cứng vào 1 kỳ.** Ví dụ có 10 lab trong `LABS`, nhưng 1 kỳ chỉ chọn ra một tập con (vd. 3 lab) để giao cho lớp — việc "kỳ nào dùng lab nào" được quyết định qua `CLASS_LABS` (vì `CLASSES` đã gắn với `TERMS`), không cần cột `term_id` trên `LABS`.
- **Submission theo mô hình phẳng — 1 bảng `SUBMISSIONS` duy nhất, không tách Order/OrderItem.** (Quyết định sửa lại ngày 2026-07-04, thay thế thiết kế Order + OrderItem 2 tầng trước đó.)
  - `SUBMISSIONS` FK trực tiếp vào `CLASS_STUDENTS` (sinh viên trong đúng lớp đó) + `CLASS_LABS` (lab được giao cho lớp đó). Mỗi lần chấm (nộp lần đầu, nộp muộn, chấm lại) là **1 dòng riêng** trong chính bảng `SUBMISSIONS`, không ghi đè, không cần bảng cha "order" trung gian.
  - Cột `attempt_no` tăng dần trong phạm vi `(class_student_id, class_lab_id)` xác định thứ tự lần chấm — `attempt_no = 1` là lần nộp gốc, `attempt_no > 1` là chấm lại. Việc này thay thế hoàn toàn vai trò "order" của thiết kế cũ mà không cần bảng riêng.
  - Học sinh xem: chọn 1 lab → thấy toàn bộ dòng `SUBMISSIONS` của mình cho `(class_student_id, class_lab_id)` đó, sắp theo `attempt_no` — điểm đợt 1 và các đợt chấm lại sau đều xem lại được, không mất lịch sử.
  - `RESUBMISSION_REQUESTS` trỏ thẳng vào `submission_id` (dòng chấm dẫn tới yêu cầu) và `created_submission_id` (dòng chấm mới được tạo ra sau khi yêu cầu hoàn tất, nullable) — không còn phân biệt "source_item"/"created_item" vì không còn khái niệm order/item tách rời.
  - Lý do đổi: mô hình Order + OrderItem (2 bảng) tạo thêm 1 tầng gián tiếp không cần thiết vì `CLASS_STUDENTS` đã đủ vai trò nhóm theo sinh viên+lớp; gộp về 1 bảng giúp truy vấn đơn giản hơn (không cần join qua bảng order trung gian) trong khi vẫn giữ đầy đủ lịch sử từng lần chấm.

---

## User Stories

- **[P1]** As an admin, I want to browse by term → class → student, so that I can see the class roster for any semester.
  Accepted when: Admin chọn 1 `TERMS`, thấy danh sách `CLASSES` thuộc kỳ đó; chọn 1 lớp, thấy danh sách sinh viên (`CLASS_STUDENTS`) thuộc lớp.

- **[P1]** As an admin, I want to manage a global lab catalog and pick which labs apply to a given term/class, so that not every term is forced to reuse the exact same lab set.
  Accepted when: Admin có thể tạo lab mới trong `LABS` độc lập với kỳ học; gán 1 lab cho 1 lớp cụ thể qua `CLASS_LABS` (vd. chọn 3 trong 10 lab hiện có cho lớp của kỳ này), có deadline riêng theo lớp.

- **[P1]** As an admin, I want to see how many times each student has actually been regraded for a given lab, so that I can spot students who resubmit excessively.
  Accepted when: Với 1 lớp + 1 lab, admin thấy bảng liệt kê từng sinh viên kèm số đếm = `COUNT(SUBMISSIONS WHERE item_type = 'resubmit')` cho `(class_student_id, class_lab_id)` đó — breakdown theo từng sinh viên, không phải tổng số của lớp, không tính request bị admin reject.

- **[P1]** As a student, I want to be able to request a regrade for the same lab up to 3 times (not just a single lifetime approval), and be warned when I hit the limit, so that I have a fair number of retries without unlimited spam.
  Accepted when: Hệ thống không còn chặn tạo/update yêu cầu chỉ vì đã từng có 1 yêu cầu `approved` trước đó cho lab đó — sinh viên được phép tối đa **3 dòng `SUBMISSIONS` với `item_type = 'resubmit'`** cho mỗi `(class_student_id, class_lab_id)`. Ở lần yêu cầu thứ 4, hệ thống chặn và hiển thị cảnh báo "đã đạt giới hạn số lần chấm lại cho lab này", không tạo thêm dòng `SUBMISSIONS`/`RESUBMISSION_REQUESTS` nữa. Rate limit hiện có (60s giữa 2 thao tác, tối đa 5 thao tác/giờ khi đang `pending`) vẫn giữ nguyên trong phạm vi 3 lần đó.

- **[P1]** As a student with multiple labs assigned in my class, I want to explicitly pick which lab I'm requesting a regrade for, so that my request is never applied to the wrong lab.
  Accepted when: Dialog yêu cầu chấm lại bắt buộc chọn 1 `CLASS_LABS` cụ thể trong số các lab đã giao cho lớp của sinh viên (không tự suy luận "lab gần nhất" hay để mặc định); hệ thống dùng lựa chọn đó để tìm dòng `SUBMISSIONS` mới nhất theo `(class_student_id, class_lab_id)` rồi mới tạo `RESUBMISSION_REQUESTS` trỏ vào `submission_id` đó. Nếu sinh viên chưa có dòng `SUBMISSIONS` nào cho lab được chọn (chưa từng nộp/được chấm), hệ thống chặn và báo "chưa có bài nộp cho lab này" thay vì tạo request rỗng.

- **[P1]** As a student, I want to open my submission history for a lab and see every grading round, so that I know how my score changed over time.
  Accepted when: Student chọn 1 lab, thấy toàn bộ dòng `SUBMISSIONS` của mình cho `(class_student_id, class_lab_id)` đó, sắp theo `attempt_no` (1, 2, 3...) kèm điểm, trạng thái, thời điểm chấm — không chỉ dòng mới nhất.

- **[P1]** As a student, I want to see the detailed test-case breakdown for each grading round, so that I can understand why a specific attempt passed or failed.
  Accepted when: Mở 1 dòng `SUBMISSIONS` cụ thể, thấy `details` (test case passed/failed, build log, response thực tế) đúng của dòng đó, không bị lẫn với dòng khác.

- **[P2]** As an admin, I want existing data (roster, past scores, resubmission requests) migrated into the new schema without loss, so that historical scores remain queryable.
  Accepted when: Sau migration, mọi bản ghi `allowed_emails`/`submissions`/`resubmission_requests` cũ đều có bản ghi tương ứng trong `STUDENTS`/`CLASS_STUDENTS`/`SUBMISSIONS`/`RESUBMISSION_REQUESTS`, không có bản ghi bị mất (đếm số dòng trước/sau khớp nhau, trừ trường hợp trùng lặp hợp lệ).

- **[P1]** As the grading tool in the `be` repo, I want to append a new row instead of overwriting the existing score, so that each regrade is preserved as its own history entry.
  Accepted when: Sau khi tool chấm chạy xong cho 1 (class_student, class_lab), hệ thống INSERT 1 dòng `SUBMISSIONS` mới với `attempt_no` tăng dần trong phạm vi `(class_student_id, class_lab_id)`, thay vì UPDATE dòng cũ.

- **[P1]** As an admin, I want to navigate the dashboard by term → class → lab → student, so that the page structure matches the new normalized data model instead of the old flat class+lab picker.
  Accepted when: Admin dashboard route/nav được thiết kế lại (đập đi xây lại) theo phân cấp `TERMS → CLASSES → LABS → CLASS_LABS → SUBMISSIONS`, không còn dựa vào string `class_name`/`lab_id` rời rạc như hiện tại.

- **[P1]** As a student, I want the score-viewing pages rebuilt around per-attempt submissions, so that I can navigate my history (lab → attempt list → attempt detail) naturally.
  Accepted when: Student dashboard route/nav được thiết kế lại để duyệt theo lab → danh sách các lần chấm (`SUBMISSIONS` sắp theo `attempt_no`) → chi tiết 1 lần chấm, thay vì trang đơn hiển thị 1 điểm duy nhất/lab như hiện tại.

- **[P3]** _(out of scope — noted for future)_ Teacher role xem điểm các lớp mình phụ trách.

---

## Functional Requirements

1. FR-01: Tạo bảng `TERMS` (kỳ học), `CLASSES` (thuộc 1 `TERMS`). Tạo bảng `LABS` là **catalog toàn cục, không có `term_id`** — 1 lab có thể được dùng lại ở nhiều kỳ khác nhau hoặc không kỳ nào cả.
2. FR-02: Tạo bảng `CLASS_LABS` (gán 1 lab cụ thể từ catalog `LABS` cho 1 lớp cụ thể, có deadline riêng, có `status`) — đây là nơi duy nhất quyết định "lớp này/kỳ này dùng những lab nào", không phải `LABS` tự quyết định.
3. FR-03: Tạo bảng `STUDENTS` (identity thật, thay cho vai trò hiện do `allowed_emails` đảm nhiệm) và `CLASS_STUDENTS` (quan hệ nhiều-nhiều sinh viên–lớp, có `status`).
4. FR-04: Tạo bảng `SUBMISSIONS` (bảng phẳng, không tách order/item): khóa chính `id`, FK `class_student_id` → `CLASS_STUDENTS` + `class_lab_id` → `CLASS_LABS`, `attempt_no` (tăng dần trong phạm vi `(class_student_id, class_lab_id)`, có `UNIQUE(class_student_id, class_lab_id, attempt_no)` để chống trùng khi 2 lần chấm chạy gần nhau), `item_type` (`original`/`late`/`resubmit`), `source_url` (drive link), `score`, `status`, `details jsonb`, `submitted_at`, `graded_at`. Quy tắc gán `item_type`: `attempt_no = 1` và nộp trước/đúng `CLASS_LABS.deadline` → `original`; `attempt_no = 1` và nộp sau deadline → `late`; `attempt_no > 1` → `resubmit`. Không có bảng "order" trung gian — mỗi lần chấm là 1 dòng độc lập trong chính bảng này.
5. FR-05: Xây dựng cơ chế sinh `attempt_no` an toàn dưới tải đồng thời: dùng Postgres advisory lock (khóa theo hash của `(class_student_id, class_lab_id)`, vì có thể chưa tồn tại dòng nào để lock theo row) trong 1 RPC function `SECURITY DEFINER`, tính `attempt_no = MAX(attempt_no)+1` (hoặc `1` nếu chưa có dòng nào) rồi INSERT trong cùng transaction. `UNIQUE(class_student_id, class_lab_id, attempt_no)` là safety net.
6. FR-06: Cập nhật `RESUBMISSION_REQUESTS` để tham chiếu FK thật: `submission_id` (→ dòng `SUBMISSIONS` dẫn tới yêu cầu này, đã mang theo ngữ cảnh class_student + class_lab), `created_submission_id` (dòng `SUBMISSIONS` được tạo ra sau khi request hoàn tất, nullable) — thay cho các cột string rời rạc (`email`, `name`, `class_name`, `lab_id`) hiện tại. Bỏ rule cũ "đã có yêu cầu `approved` thì không được tạo yêu cầu mới" — thay bằng giới hạn **tối đa 3 dòng `item_type = 'resubmit'`** cho mỗi `(class_student_id, class_lab_id)`. Ở lần yêu cầu thứ 4, hệ thống chặn tạo/update request và trả về cảnh báo đã đạt giới hạn. Rate limit hiện có (60s/thao tác, tối đa 5 thao tác pending/giờ) vẫn giữ nguyên trong phạm vi 3 lần cho phép.
7. FR-07: Viết migration script chuyển dữ liệu cũ: tạo đúng **1 `TERMS`** duy nhất (đại diện cho kỳ hiện tại) và gán toàn bộ `CLASSES` suy ra từ `class_name` hiện có vào kỳ đó — không cần bảng mapping thủ công class_name→term ở lần migrate đầu tiên (dữ liệu các kỳ sau, khi có, sẽ tạo `TERMS` mới riêng); `allowed_emails` → `STUDENTS` + `CLASS_STUDENTS`; mỗi lab_id duy nhất xuất hiện trong `submissions` cũ → 1 dòng `LABS` (catalog), gán vào `CLASS_LABS` theo lớp tương ứng; mỗi cặp (student, lab) hiện có trong `submissions` → 1 dòng `SUBMISSIONS` với `attempt_no = 1` (không tái tạo được lịch sử đã mất do overwrite); `resubmission_requests` → nối FK vào dòng `SUBMISSIONS` tương ứng.
8. FR-08: Chuẩn hóa `lab_id`/`lab_code` về 1 format thống nhất trước khi map sang `LABS.id`, do dữ liệu hiện tại không nhất quán (có chỗ dùng tên đầy đủ, có chỗ viết thường rút gọn).
9. FR-09: Đổi logic sync trong repo `be`: từ UPSERT theo `(student_id, lab_id)` sang gọi RPC sinh `attempt_no` (FR-05) rồi INSERT 1 dòng `SUBMISSIONS` mới cho đúng `(class_student_id, class_lab_id)` — không UPDATE dòng cũ.
10. FR-10: Cập nhật admin query "xem kết quả theo lớp/lab" để lấy dòng `SUBMISSIONS` có `attempt_no` cao nhất trong mỗi `(class_student_id, class_lab_id)` làm điểm hiển thị chính, cộng thêm cột đếm số dòng `item_type = 'resubmit'` (số lần chấm lại) — nên dùng SQL view/aggregate thay vì tính bằng JS Map như hiện tại để tránh N+1 query.
11. FR-11: Cập nhật student query "xem điểm" để trả về toàn bộ dòng `SUBMISSIONS` của sinh viên theo lab, sắp theo `attempt_no`, kèm `details` riêng từng dòng.
12. FR-12: Thiết kế lại route/nav admin dashboard theo phân cấp `TERMS → CLASSES → CLASS_LABS → STUDENTS` (thay cho picker lớp+lab rời rạc hiện tại ở `/admin/dashboard`).
13. FR-13: Thiết kế lại route/nav student dashboard theo luồng lab → danh sách các lần chấm (`SUBMISSIONS` theo `attempt_no`) → chi tiết 1 lần chấm (thay cho trang hiển thị 1 điểm/lab hiện tại).
14. FR-14: Giữ nguyên toàn bộ hạ tầng auth, Supabase server client, và role-check middleware hiện có — không rebuild, chỉ tái sử dụng khi viết lại các trang/data-fetching điểm.
15. FR-15: Giữ nguyên UI/luồng resubmission request (dialog gửi yêu cầu, Discord webhook, trang duyệt request của admin) — chỉ nối lại FK sang `SUBMISSIONS` theo FR-06, không thiết kế lại giao diện.
16. FR-16: Áp dụng ngưỡng Pass/Fail (điểm ≥ 5.0) độc lập cho **từng** dòng `SUBMISSIONS`, không chỉ cho dòng mới nhất — mỗi dòng tự có `status` quy đổi riêng.
17. FR-17: Bỏ logic suy luận "lab chưa nộp" bằng cách diff 2 danh sách `lab_id` trong JS (cách hiện tại) — thay bằng join trực tiếp `CLASS_LABS` (nguồn thật cho "lab nào được giao cho lớp") với `SUBMISSIONS` của sinh viên đó (không có dòng nào = chưa nộp).
18. FR-18: Dialog tạo yêu cầu chấm lại bắt buộc sinh viên chọn đúng 1 `CLASS_LABS` (lab cụ thể trong lớp mình) khi lớp có nhiều hơn 1 lab đang hoạt động — không cho phép tạo request "mặc định" theo lab gần nhất hoặc lab đang xem dở. Server action validate: (a) `class_lab_id` được chọn thuộc đúng lớp của sinh viên, (b) tồn tại ít nhất 1 dòng `SUBMISSIONS` cho `(class_student_id, class_lab_id)` đó trước khi cho tạo `RESUBMISSION_REQUESTS`, tránh trường hợp request bị gán nhầm sang lab khác hoặc tạo cho lab chưa có bài nộp nào.
19. FR-19: Rollout theo thứ tự **schema/migration ở repo này trước, sync tool ở repo `be` sau**. Trong khoảng thời gian giữa 2 lần deploy, cần một lớp tương thích tạm thời để sync tool cũ (vẫn UPSERT theo `(student_id, lab_id)`) không ghi sai vào schema mới — ví dụ tạm dừng sync tool trong lúc chạy migration, hoặc dựng view/compat layer chuyển UPSERT cũ thành INSERT dòng `SUBMISSIONS` mới qua RPC. Chỉ gỡ lớp tương thích này sau khi sync tool mới (FR-09) đã deploy xong ở repo `be`.

---

## Non-Functional Requirements

- Performance: Trang admin "xem kết quả theo lớp/lab kèm số lần chấm lại" phải chạy bằng 1 query có aggregate (COUNT/GROUP BY), không lặp lại truy vấn 2 lần như code hiện tại (`getAdminStudentResultsAction`).
- Data integrity: Toàn bộ FK giữa `CLASSES`/`LABS`/`CLASS_LABS`/`STUDENTS`/`CLASS_STUDENTS`/`SUBMISSIONS`/`RESUBMISSION_REQUESTS` phải là FK vật lý (constraint thật trong Postgres/Supabase), không còn quan hệ logic qua string.
- Data integrity: `attempt_no` sinh ra qua RPC dùng advisory lock theo `(class_student_id, class_lab_id)` (không chỉ tính `MAX+1` ở application code) để tránh race condition khi 2 lần chấm chạy gần nhau tạo trùng `attempt_no` — advisory lock được chọn thay vì row lock vì có thể chưa tồn tại dòng `SUBMISSIONS` nào để lock (lần nộp đầu tiên).
- Migration safety: Script migrate dữ liệu cũ phải chạy được dry-run (đếm số dòng, so sánh trước/sau) trước khi áp dụng thật lên production Supabase.
- Security: `SUBMISSIONS` phải có Row Level Security (Supabase RLS) giới hạn student chỉ đọc được dòng của chính mình (theo `student_id` trong token, nối qua `class_student_id`) — không tự động thừa hưởng rule cũ của `submissions`, phải khai báo lại tường minh cho bảng mới.

---

## Success Criteria

- [ ] Admin có thể xem: kỳ → lớp → sinh viên → số lần chấm lại (breakdown per student) trong 1 lượt tải trang, không cần nhiều lần chọn lọc thủ công.
- [ ] Student có thể mở 1 lab của mình và xem toàn bộ lịch sử điểm (≥1 dòng `SUBMISSIONS`), không chỉ điểm mới nhất.
- [ ] Sau migration, số lượng bản ghi `STUDENTS`/`LABS`/`SUBMISSIONS`/`RESUBMISSION_REQUESTS` khớp với số lượng suy ra được từ dữ liệu cũ (0 mất mát, ngoại trừ lịch sử overwrite đã mất trước khi migrate).
- [ ] Sync tool ở repo `be` chạy chấm lại 1 sinh viên 2 lần liên tiếp tạo ra 2 dòng `SUBMISSIONS` phân biệt (attempt_no = 1, 2) cho cùng `(class_student_id, class_lab_id)`, không ghi đè.
- [ ] Sinh viên gửi yêu cầu chấm lại lần thứ 4 cho cùng 1 lab bị chặn và nhận cảnh báo rõ ràng, không tạo thêm dòng `SUBMISSIONS`/`RESUBMISSION_REQUESTS` mới.
- [ ] 1 lab trong catalog `LABS` có thể được gán cho lớp ở kỳ A nhưng không gán cho lớp ở kỳ B mà không cần sửa dữ liệu `LABS`.

---

## Out of Scope

- Teacher role/dashboard nghiệp vụ (chỉ Admin + Student lần này).
- Xuất báo cáo (export) — nêu trong giới hạn hiện tại của repo nhưng không nằm trong phạm vi chuẩn hóa ERD lần này.
- Tái tạo lịch sử các lần chấm đã bị ghi đè trước khi migration chạy (không thể khôi phục vì dữ liệu gốc đã mất).
- Rebuild hạ tầng auth/Supabase client/role-check — pattern hiện có được giữ nguyên, chỉ tái sử dụng.
- Rebuild UI/luồng resubmission request (dialog, rate limit, Discord webhook, trang duyệt của admin) — chỉ đổi cách lưu FK bên dưới, giao diện giữ nguyên.
- Thay đổi visual design system/style chung (theme, component library) — rebuild chỉ ở mức cấu trúc route/data theo ERD mới, không phải redesign giao diện.
- Trạng thái "đóng/khóa" cho `SUBMISSIONS` — theo thiết kế, mỗi dòng chấm là độc lập và vĩnh viễn, không có luồng nghiệp vụ đóng/khóa lịch sử chấm.

---

## Assumptions

- Repo `be` (grading tool) và repo này chia sẻ cùng 1 Supabase project — thay đổi schema ảnh hưởng trực tiếp đến cả 2 repo, cần phối hợp thời điểm deploy.
- `class_name` hiện tại trong dữ liệu sản xuất đủ sạch (không có lỗi chính tả/khác biệt hoa-thường nghiêm trọng) để map 1-1 sang `CLASSES`, sau khi qua bước chuẩn hóa.
- Nghiệp vụ resubmission request (validate Google Drive link, rate limit, Discord webhook) giữ nguyên như hiện tại — chỉ đổi cách lưu trữ FK, không đổi luồng nghiệp vụ.
- Mỗi lab trong catalog `LABS` chỉ được gán tối đa 1 lần cho mỗi lớp (`UNIQUE(class_id, lab_id)` trên `CLASS_LABS`) — không có khái niệm 1 lớp học 1 lab 2 lần trong cùng 1 kỳ.

---

## [NEEDS CLARIFICATION]

_Không còn mục nào mở — cả 2 mục đã được giải quyết trong phiên `/ck:plan` 2026-07-04, xem ghi chú bên dưới._

<!-- Đã giải quyết trong phiên brainstorm 2026-07-04:
- Giới hạn regrade/lab: bỏ chặn "1 approved/đời", thay bằng tối đa 3 lần chấm lại (3 item `resubmit`); lần thứ 4 bị chặn kèm cảnh báo (FR-06).
- Cách đếm "số lần chấm lại": COUNT(SUBMISSION_ITEMS WHERE item_type='resubmit'), không tính request bị reject.
- LABS tách thành catalog toàn cục, không gắn `term_id` — việc gán lab cho kỳ/lớp nằm ở CLASS_LABS.
- Submission đổi từ mô hình version phẳng sang Order (SUBMISSIONS) + OrderItem (SUBMISSION_ITEMS) — order luôn mở, không có luồng đóng order.

Đã giải quyết trong phiên /ck:plan 2026-07-04:
- TERM inference cho dữ liệu cũ: toàn bộ dữ liệu hiện có được gán vào 1 TERMS duy nhất đại diện cho kỳ hiện tại (chưa có dữ liệu của các kỳ sau). Migration script không cần bảng mapping thủ công class_name→term; admin có thể tách lại thủ công sau nếu cần.
- Thứ tự rollout 2 repo: schema/migration ở repo này chạy trước, sync tool ở repo `be` cập nhật sau. Cần một lớp tương thích tạm thời (view/alias hoặc tạm dừng sync) trong khoảng thời gian giữa 2 lần deploy để tool cũ không ghi sai vào schema mới.

Sửa lại sau khi plan đã viết xong (cùng ngày 2026-07-04): bỏ mô hình Order (SUBMISSIONS) + OrderItem (SUBMISSION_ITEMS) 2 bảng, gộp về 1 bảng `SUBMISSIONS` phẳng, FK trực tiếp `class_student_id` + `class_lab_id`, dùng cột `attempt_no` thay cho `item_no`. Lý do: `CLASS_STUDENTS` đã đủ vai trò nhóm sinh viên+lớp, không cần thêm 1 bảng "order" trung gian chỉ để giữ vai trò gom nhóm — gộp lại giúp query đơn giản hơn mà vẫn giữ đủ lịch sử từng lần chấm và không đổi ngữ nghĩa nghiệp vụ (giới hạn 3 lần chấm lại, chọn đúng lab, breakdown per student đều giữ nguyên). Cơ chế chống trùng đổi từ row-lock trên bảng order sang Postgres advisory lock theo hash `(class_student_id, class_lab_id)` vì không còn dòng cha để lock khi chưa từng có submission nào.
-->
