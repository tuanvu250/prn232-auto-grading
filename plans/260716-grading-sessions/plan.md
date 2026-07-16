# Kế hoạch chuyển `class_labs` thành grading session và loại bỏ resubmission

## 1. Trạng thái

- Ngày lập kế hoạch: 2026-07-16.
- Migration Phase 1 đã apply lên Supabase production ngày 2026-07-16:
  - `class_labs` đã rename thành `grading_sessions`.
  - `class_lab_submissions` đã rename thành `session_submissions`.
  - Dữ liệu đã reconcile: 8 session, 358 submission, không orphan hoặc cross-class.
  - Hai bảng request vẫn được giữ lại để audit/rollback; application cutover và Phase 3 chưa triển khai.
- Quyết định nghiệp vụ đã chốt:
  - Một grading session/đợt nộp thuộc đúng một lớp và một Lab.
  - Giảng viên có thể tạo nhanh nhiều session bằng cách chọn nhiều lớp trong cùng học kỳ.
  - Chọn 5 lớp tạo 5 session độc lập với cùng cấu hình ban đầu.
  - Điểm và submission phải thuộc trực tiếp session tương ứng.
  - Không còn quy trình xin resubmit; sinh viên muốn nộp lại sẽ nộp trong session tiếp theo do giảng viên mở.

## 2. Mục tiêu

1. Đổi đúng ý nghĩa nghiệp vụ của `class_labs`: mỗi dòng trở thành một grading session thay vì chỉ là quan hệ gán Lab cho lớp.
2. Cho phép một lớp có nhiều session cho cùng một Lab.
3. Giữ nguyên ID và liên kết của dữ liệu điểm cũ để giảm tối đa rủi ro migration.
4. Cho phép giảng viên tạo session hàng loạt cho nhiều lớp trong một thao tác.
5. Hiển thị điểm theo session trên cả giao diện giảng viên và sinh viên.
6. Loại bỏ bảng, RPC, server action và giao diện resubmission.
7. Cập nhật grading sync để luôn ghi điểm vào đúng session, không còn suy luận theo request resubmit.

## 3. Ngoài phạm vi

- Không xây dựng workflow xin duyệt nộp lại.
- Không tự động tạo session tiếp theo khi sinh viên muốn nộp lại; session chỉ do giảng viên tạo.
- Không tạo bảng batch riêng cho thao tác chọn nhiều lớp. Các session được tạo cùng lúc là các dòng độc lập, theo nguyên tắc YAGNI.
- Không thay đổi danh mục `labs`, `terms`, `classes`, `students` và `class_students` ngoài các truy vấn cần thiết.
- Không gom các submission cũ thành session mới dựa trên resubmission request; chúng tiếp tục nằm trong session legacy đang liên kết.

## 4. Mô hình dữ liệu đích

### 4.1. `grading_sessions`

Đổi tên trực tiếp bảng `class_labs` để giữ nguyên primary key và foreign key hiện có.

```text
grading_sessions
- id uuid PK
- class_id uuid FK -> classes.id
- lab_id uuid FK -> labs.id
- name text not null
- deadline timestamptz null
- drive_root_url text null
- status text not null          -- open | closed
- created_at timestamptz
```

Quy tắc:

- Bỏ `UNIQUE(class_id, lab_id)` để cho phép nhiều đợt của cùng Lab trong một lớp.
- Tại một thời điểm chỉ có tối đa một session `open` cho cùng `(class_id, lab_id)`.
- Dùng partial unique index cho `(class_id, lab_id) WHERE status = 'open'` để chống tạo trùng và giúp grading tool resolve không mơ hồ.
- Session mới mặc định `open`; việc thêm trạng thái `draft` hoặc lịch mở tự động chưa nằm trong requirement hiện tại.
- `name` là tên dễ đọc, ví dụ `Lab 1 - Đợt chính` hoặc `Lab 1 - Đợt bổ sung`.

### 4.2. `session_submissions`

Đổi tên `class_lab_submissions` thành `session_submissions` và đổi `class_lab_id` thành `grading_session_id`.

```text
session_submissions
- id uuid PK
- class_student_id uuid FK -> class_students.id
- grading_session_id uuid FK -> grading_sessions.id
- attempt_no integer
- item_type text
- source_url text
- score numeric
- status text
- details jsonb
- submitted_at timestamptz
- graded_at timestamptz
- created_at timestamptz
```

Quy tắc chuyển tiếp:

- Giữ `attempt_no` và các giá trị `item_type` cũ để không làm mất lịch sử đã import.
- Mọi submission mới sau cutover dùng `item_type = 'original'`; không tạo thêm `resubmit` hoặc `late` từ request.
- RPC ghi điểm tiếp tục khóa theo `(class_student_id, grading_session_id)` để tránh trùng `attempt_no` khi sync đồng thời.
- Không ép dữ liệu cũ thành một submission duy nhất mỗi session vì có thể làm mất các lần chấm lịch sử.

### 4.3. Bỏ resubmission

Loại bỏ khỏi schema production:

- `resubmission_requests_v2`.
- Bảng legacy `resubmission_requests` nếu vẫn còn tồn tại sau khi kiểm kê.
- RPC `create_resubmission_request`.
- Tham số `p_fulfills_request_id` và đoạn cập nhật request trong RPC tạo submission.
- Index, policy, trigger và constraint chỉ phục vụ resubmission.

Lưu ý: schema hiện tại dùng `resubmission_requests_v2` cho cả `request_type = 'resubmit'` và `request_type = 'late'`. Việc bỏ bảng đồng nghĩa bỏ cả hai loại request. Sau cutover, ngoại lệ nộp lại/nộp trễ chỉ được xử lý bằng một session mới do giảng viên mở.

## 5. Chiến lược migration dữ liệu cũ

### Phase 0 — Kiểm kê và khóa điều kiện triển khai

1. Ghi nhận row count của `class_labs`, `class_lab_submissions`, `resubmission_requests_v2` và bảng legacy liên quan.
2. Kiểm tra orphan FK, session không có lớp/Lab và submission không có `class_lab_id` hợp lệ.
3. Kiểm tra request đang `pending` hoặc `approved`; thông báo thời điểm cutover cho giảng viên trước khi vô hiệu hóa workflow.
4. Xuất snapshot CSV/JSON hoặc database backup của toàn bộ request cũ để phục vụ audit. Snapshot không được import trở lại luồng nghiệp vụ mới.
5. Tạm dừng grading sync trong cửa sổ migration để tránh ghi dữ liệu giữa hai schema.

### Phase 1 — Migration schema không làm đổi ID

Thực hiện trong transaction khi các thao tác PostgreSQL cho phép:

1. Drop unique constraint `(class_id, lab_id)` trên `class_labs`.
2. Rename `class_labs` thành `grading_sessions`.
3. Thêm `name` nullable tạm thời và `status` với giá trị mặc định an toàn.
4. Backfill session cũ:
   - `name`: sinh từ mã Lab, ví dụ `<LAB_CODE> - Đợt 1`.
   - `status`: `closed` nếu deadline đã qua; ngược lại `open`.
5. Nếu dữ liệu bất thường làm xuất hiện nhiều session `open` cho một cặp lớp/Lab, đóng các dòng cũ hơn và ghi báo cáo reconcile.
6. Chuyển `name` thành `NOT NULL`, thêm check constraint cho `status` và partial unique index của session đang mở.
7. Rename `class_lab_submissions` thành `session_submissions`.
8. Rename `class_lab_id` thành `grading_session_id`, đồng thời đổi tên index/constraint để phản ánh semantic mới.
9. Thay RPC `create_class_lab_submission` bằng RPC ghi `session_submissions`; bỏ mọi phụ thuộc vào resubmission request.

Việc rename giữ nguyên UUID nên submission cũ vẫn trỏ đúng session, không cần backfill khóa ngoại theo mapping mới.

### Phase 2 — Cutover ứng dụng và grading sync

1. Deploy code đọc được `grading_sessions` và `session_submissions` trước khi drop bảng request.
2. Cập nhật grading tool theo một trong hai cách, ưu tiên theo thứ tự:
   - Gửi trực tiếp `grading_session_id` khi chấm.
   - Compatibility fallback: resolve đúng session `open` bằng `(class_name, lab_code)`; lỗi rõ ràng nếu không có hoặc có nhiều session.
3. Xác nhận một kết quả sync thử nghiệm xuất hiện đúng session, đúng lớp và đúng sinh viên.
4. Chặn grading vào session `closed` tại RPC, không chỉ chặn ở UI.

### Phase 3 — Gỡ resubmission an toàn

Chỉ thực hiện sau khi frontend, server actions và grading tool không còn đọc/ghi bảng request:

1. Gỡ UI và API tạo/duyệt/từ chối request.
2. Gỡ metric, dashboard panel và Discord notification liên quan.
3. Drop RPC/policy/index/trigger của resubmission.
4. Drop `resubmission_requests_v2` và bảng legacy sau khi snapshot cùng row count đã được xác nhận.
5. Chạy reconcile để bảo đảm row count session/submission không thay đổi ngoài dữ liệu test có chủ đích.

## 6. Thiết kế luồng giảng viên

### 6.1. Điều hướng

```text
Admin
└── Terms
    └── Classes
        └── Class detail
            └── Grading sessions
                └── Session student results
```

Route mục tiêu:

```text
/admin/terms/[termId]/classes
/admin/terms/[termId]/classes/[classId]/sessions
/admin/terms/[termId]/classes/[classId]/sessions/[sessionId]/students
```

Các route `/labs/[classLabId]` cũ nên redirect tạm thời sang route session tương ứng để bookmark cũ không hỏng ngay sau deploy.

### 6.2. Danh sách Class

- Menu `Class` hiển thị toàn bộ lớp thuộc học kỳ đang chọn.
- Mỗi lớp dẫn tới danh sách grading session của lớp đó.
- Giữ cách trình bày data-first, light/dark mode và hệ thống component hiện tại.

### 6.3. Tạo session hàng loạt

Từ trang session của một lớp:

1. Nhấn `Tạo đợt nộp`.
2. Chọn một Lab từ catalog.
3. Chọn nhiều lớp trong đúng học kỳ; lớp hiện tại được chọn sẵn.
4. Nhập tên đợt, deadline và Drive root.
5. Màn hình xác nhận hiển thị số session sẽ tạo và danh sách lớp.
6. Một lệnh insert nhiều dòng tạo các session atomically: tất cả thành công hoặc không tạo dòng nào.
7. Kết quả thành công ghi rõ `Đã tạo 5 đợt nộp cho 5 lớp`.

Validation:

- Phải chọn Lab, ít nhất một lớp và tên đợt.
- Chỉ chọn lớp trong cùng `term_id`.
- Không cho tạo session `open` mới nếu lớp đã có session `open` cho Lab đó.
- URL Drive phải hợp lệ nếu có nhập.
- Deadline phải hợp lệ; quy tắc deadline quá khứ cần bị chặn ở cả client và server.

### 6.4. Quản lý session

- Danh sách hiển thị tên đợt, Lab, trạng thái, deadline và số submission/sinh viên.
- Cho phép sửa tên, deadline, Drive root và đóng session.
- Không xóa cứng session đã có điểm từ UI; chỉ đóng session. Nếu chưa có submission mới cho phép xóa với xác nhận.
- Khi đóng session, grading tool không được ghi thêm điểm vào session đó.

## 7. Luồng sinh viên

1. Dashboard nhóm dữ liệu theo lớp và hiển thị các session của từng Lab.
2. Sinh viên mở một session để xem điểm và chi tiết submission thuộc session đó.
3. Không hiển thị nút `Request resubmission`, request history hoặc trạng thái pending/approved/rejected.
4. Nếu muốn nộp lại, giao diện giải thích ngắn: `Bạn có thể nộp lại khi giảng viên mở đợt tiếp theo.`
5. Session chưa có điểm hiển thị trạng thái chờ chấm; session đã đóng nhưng không có submission hiển thị rõ là không có bài nộp.

## 8. Phạm vi code dự kiến

### Database và tài liệu tích hợp

- Thêm migration SQL mới trong `docs/api/` gồm preflight, apply, reconcile và rollback có điều kiện.
- Cập nhật RLS cho `grading_sessions` và `session_submissions`.
- Cập nhật grading sync guide để nhận/resolve `grading_session_id`.
- Cập nhật ERD và `docs/system-spec-vi.md`.

### Server actions, query và types

- Đổi các type `ClassLab*` thành `GradingSession*` theo từng bước nhỏ, tránh alias tồn tại lâu dài.
- Thay action assign Lab bằng bulk create session.
- Đổi query key và query function từ class-lab sang grading-session.
- Xóa action/query/type resubmission không còn sử dụng.
- Giữ validation và authorization ở server; client validation chỉ phục vụ UX.

### Admin UI

- Đổi trang Lab của lớp thành trang session.
- Thêm form chọn nhiều lớp trong cùng kỳ.
- Đổi trang kết quả từ `classLabId` sang `sessionId`.
- Bỏ tab/panel/metric/dialog resubmission và các cột `Resubmits`.

### Student UI

- Đổi route và copy từ class-lab sang session.
- Bỏ `AttemptResubmissionDialog`, `ResubmissionDialog` và request history.
- Hiển thị các đợt của cùng Lab tách biệt, có deadline/trạng thái/điểm riêng.

### Integration phụ trợ

- Gỡ Discord notification cho resubmission.
- Cập nhật grading tool/repo backend trong cùng release window; đây là dependency bắt buộc trước khi drop compatibility cũ.

## 9. Thứ tự triển khai đề xuất

1. Viết migration preflight/apply/reconcile/rollback và test trên database clone.
2. Thêm compatibility types/actions để ứng dụng đọc schema mới.
3. Cập nhật grading RPC và grading tool để định danh session.
4. Xây bulk-create session và trang quản lý session cho admin.
5. Chuyển trang kết quả admin và student sang `sessionId`.
6. Gỡ toàn bộ UI/action/query/type resubmission.
7. Deploy theo cửa sổ cutover, chạy migration và smoke test end-to-end.
8. Sau thời gian xác minh, drop bảng/RPC resubmission và compatibility route/code.
9. Cập nhật tài liệu, ERD và xóa dead code.

Không drop bảng request ở bước đầu. Trình tự này giữ khả năng rollback cho đến khi grading sync và hai giao diện đã chạy ổn trên session.

## 10. Kiểm thử và xác minh

### Database

- Row count `grading_sessions` sau rename bằng row count `class_labs` trước migration.
- Row count `session_submissions` bằng row count `class_lab_submissions` trước migration.
- Không có orphan `grading_session_id`.
- Mỗi session thuộc đúng lớp và Lab.
- Không thể có hai session `open` cùng `(class_id, lab_id)`.
- Không thể ghi điểm vào session `closed`.
- Snapshot request có row count khớp trước khi drop.

### Unit/integration

- Bulk create 1, 5 và số lượng lớp lớn hơn một trang phân trang.
- Bulk create rollback toàn bộ khi một lớp vi phạm constraint.
- Authorization: student/teacher không đúng quyền không thể tạo, sửa hoặc đóng session.
- Grading RPC ghi đúng session và tăng `attempt_no` an toàn khi có concurrent call.
- Không còn import hoặc query tới resubmission module.

### UI/E2E

- Giảng viên vào đúng học kỳ, thấy đúng danh sách lớp.
- Từ một lớp tạo một session cho 5 lớp và nhận đúng kết quả.
- Mỗi lớp hiển thị session vừa tạo.
- Điểm sync xuất hiện ở đúng session trên admin và student.
- Session cùng Lab ở đợt tiếp theo không trộn điểm với đợt trước.
- Loading, empty, error, partial network failure và success feedback rõ ràng.
- Form hoạt động bằng bàn phím, có focus state, label và thông báo lỗi đạt WCAG AA.
- Responsive ở mobile/tablet/desktop, danh sách nhiều lớp có search và vùng cuộn không làm dropdown bị cắt.

### Lệnh kiểm tra repository

```text
npm run format:check
npm run lint
npm run type-check
npm test
npm run build
```

## 11. Tiêu chí nghiệm thu

- [x] `class_labs` đã được chuyển thành `grading_sessions` mà không đổi/mất ID cũ.
- [x] `class_lab_submissions` đã trở thành `session_submissions` và dữ liệu cũ còn đầy đủ.
- [x] Schema cho phép một lớp có nhiều session cho cùng Lab, nhưng chỉ có tối đa một session đang mở.
- [ ] Chọn 5 lớp tạo đúng 5 session độc lập trong một thao tác atomic.
- [ ] Submission và điểm được hiển thị đúng theo session trên admin và student.
- [ ] Grading tool không còn resolve mơ hồ khi có nhiều session của cùng Lab/lớp.
- [ ] Không còn UI, action, query, RPC, metric hoặc notification resubmission.
- [ ] `resubmission_requests_v2` và bảng legacy đã được snapshot rồi loại khỏi production.
- [ ] Sinh viên được hướng dẫn chờ session tiếp theo nếu muốn nộp lại.
- [x] Dữ liệu cũ đối soát thành công và không có orphan FK.
- [ ] Toàn bộ validation, test và build vượt qua.

## 12. Rủi ro và phương án giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Grading tool vẫn resolve bằng lớp + Lab và ghi nhầm đợt | Bắt buộc truyền `grading_session_id`; fallback chỉ cho phép đúng một session `open` |
| Drop request làm mất lịch sử audit | Backup database và xuất snapshot có row count/checksum trước khi drop |
| Request pending/approved bị bỏ giữa chừng | Thông báo cutover, đóng workflow cũ và xử lý danh sách tồn trước migration |
| Rename route làm hỏng bookmark | Redirect route cũ trong giai đoạn chuyển tiếp |
| Tạo hàng loạt thành công một phần | Dùng một bulk insert/RPC transaction và trả lỗi theo lớp |
| Session cũ bị mở sai trạng thái | Backfill theo deadline, xuất báo cáo reconcile và cho admin chỉnh trước cutover |
| Code cũ còn truy cập bảng resubmission đã drop | Chỉ drop sau static search, test, logging production và xác nhận grading tool đã cutover |

## 13. Rollback

Rollback chỉ được thực hiện trước khi có nhiều session mới cho cùng một `(class_id, lab_id)` hoặc trước khi bảng request bị drop không có backup.

1. Tạm dừng grading sync.
2. Rollback application về version tương thích schema cũ.
3. Rename `session_submissions.grading_session_id` về `class_lab_id`, rename bảng về `class_lab_submissions`.
4. Rename `grading_sessions` về `class_labs`.
5. Chỉ khôi phục `UNIQUE(class_id, lab_id)` sau khi xác nhận không có duplicate; nếu có, phải xuất và xử lý dữ liệu mới trước.
6. Khôi phục RPC/policy và bảng request từ backup nếu chúng đã bị drop.
7. Đối soát row count và FK trước khi mở lại grading sync.

Sau khi production đã có nhiều session cùng Lab/lớp, rollback bằng rename đơn giản không còn an toàn; khi đó cần forward-fix.

## 14. Design brief cho phần giao diện

- **Người dùng chính:** giảng viên quản lý nhiều lớp trong một học kỳ, cần mở đợt nhanh và kiểm tra chính xác lớp nào sẽ nhận session.
- **Hành động chính:** tạo một cấu hình session và áp dụng atomically cho nhiều lớp.
- **Visual lane:** giao diện product restrained theo `PRODUCT.md`/`DESIGN.md`; dùng component, màu cam primary, typography và light/dark mode hiện có, không tạo một design system mới.
- **Bố cục:** Class là điểm vào; trang lớp ưu tiên danh sách session, trạng thái và deadline; form bulk-create dùng progressive dialog với class search/checkbox và summary trước khi xác nhận.
- **Trạng thái bắt buộc:** loading, không có lớp/session, validation error, conflict session đang mở, success count, server failure và session closed.
- **Copy chính:** dùng thống nhất thuật ngữ `Đợt nộp` trên UI tiếng Việt và `grading session` trong code/schema.

## 15. Điểm cần xác nhận trước khi triển khai

Plan đang áp dụng quyết định sau: bỏ `resubmission_requests_v2` đồng nghĩa bỏ cả yêu cầu `resubmit` và `late`, vì hai loại đang dùng chung bảng/RPC. Nếu nghiệp vụ vẫn cần xin nộp trễ trong chính session hiện tại, phải tách một thiết kế `late_submission_requests` riêng trước khi bắt đầu migration.
