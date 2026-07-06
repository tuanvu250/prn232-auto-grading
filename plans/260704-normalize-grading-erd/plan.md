# Plan: Chuẩn hóa ERD hệ thống xem điểm chấm PRN232

Status: 🟢 Done (Phase 3 pending in be repo)
Date: 2026-07-04
Mode: Hard

## Overview

Migrate schema hiện tại (`allowed_emails`/`submissions`/`resubmission_requests`) sang mô hình chuẩn hóa `TERMS→CLASSES→CLASS_STUDENTS↔STUDENTS`, `LABS→CLASS_LABS`, và bảng `SUBMISSIONS` phẳng (mỗi lần chấm là 1 dòng, FK trực tiếp `class_student_id`+`class_lab_id`, phân biệt bằng `attempt_no`), sau đó rebuild FE admin + student dashboard và cập nhật sync tool ở repo `be` để append thay vì overwrite.

## Sprint Contract

**In Scope:**
- FR-01 → FR-08: schema DDL mới (`TERMS`, `CLASSES`, `LABS`, `CLASS_LABS`, `STUDENTS`, `CLASS_STUDENTS`, `SUBMISSIONS` phẳng, `RESUBMISSION_REQUESTS` FK mới) + migration script (dry-run + apply) + lab_id/lab_code normalization.
- FR-09: sync tool ở repo `be` chuyển sang gọi RPC sinh `attempt_no` rồi insert thẳng 1 dòng `SUBMISSIONS` mới (path riêng, PR riêng).
- FR-10, FR-11, FR-17: admin/student query rebuild dùng aggregate SQL, không N+1.
- FR-12, FR-13: rebuild route/nav admin dashboard và student dashboard theo phân cấp mới.
- FR-06, FR-18: rewiring resubmission-request dialog + server action lên FK mới, giới hạn 3 lần resubmit.
- FR-14, FR-15, FR-16: giữ nguyên auth/Supabase client/role-check, giữ nguyên UI luồng resubmission (chỉ đổi FK), pass/fail threshold áp dụng per-item.
- FR-19: compat/coordination bước freeze-migrate-resume giữa 2 repo.
- RLS mới cho bảng `SUBMISSIONS` phẳng theo NFR security.
- Success Criteria checklist cuối cùng (P2 migration story).

**Explicit Exclusions:**
- Teacher role/dashboard (Out of Scope).
- Export/report feature (Out of Scope).
- Tái tạo lịch sử điểm đã bị overwrite trước migration (không thể khôi phục).
- Rebuild auth/Supabase client infra, rebuild UI resubmission (dialog/rate-limit/Discord webhook) — chỉ đổi FK bên dưới.
- Redesign visual/theme — chỉ đổi cấu trúc route/data.
- Trạng thái "đóng/khóa" cho `SUBMISSIONS` — mỗi dòng chấm là độc lập và vĩnh viễn, không có luồng đóng/khóa.
- Compat view/trigger layer cho migration (spec + cả 2 researcher đều khuyến nghị tạm dừng sync tool thay vì dựng view tương thích).

**Verification Standard:** Toàn bộ 6 mục Success Criteria trong spec.md pass được xác nhận thủ công/qua query đối chiếu: (1) admin browse term→class→student breakdown 1 lượt tải; (2) student mở lab thấy toàn bộ dòng `SUBMISSIONS` lịch sử theo `attempt_no`; (3) migration dry-run/apply đếm dòng khớp trước/sau; (4) sync tool chấm 2 lần liên tiếp tạo 2 dòng `SUBMISSIONS` phân biệt (`attempt_no` khác nhau) cho cùng `(class_student_id, class_lab_id)`; (5) request chấm lại lần 4 bị chặn với cảnh báo rõ; (6) 1 lab gán cho lớp kỳ A không bắt buộc gán ở kỳ B.

## Phases

- [x] Phase 1: Schema DDL + RPC — TERMS/CLASSES/LABS/CLASS_LABS/STUDENTS/CLASS_STUDENTS/SUBMISSIONS (phẳng) + advisory-lock RPC sinh `attempt_no` + RESUBMISSION_REQUESTS FK mới
- [x] Phase 2: Migration script — dry-run đối chiếu + apply thật + freeze sync tool cũ trong lúc chạy
- [ ] Phase 3: Sync tool repo `be` — chuyển UPSERT sang gọi RPC sinh `attempt_no` rồi insert thẳng 1 dòng `SUBMISSIONS`, redeploy, resume traffic **(ngoài phạm vi phiên `/ck:cook` này — repo `be` nằm ngoài working directory hiện tại; chạy `/ck:cook` riêng trỏ vào `/Users/ngothanhdat/Documents/CODE/prn232/prn232-auto-grader/be` sau khi Phase 1/2 hoàn tất)**
- [x] Phase 4: RLS policies mới cho bảng `SUBMISSIONS` phẳng + các bảng liên quan
- [x] Phase 5: Rebuild FE admin dashboard theo phân cấp TERMS→CLASSES→CLASS_LABS→STUDENTS
- [x] Phase 6: Rebuild FE student dashboard (lab→danh sách dòng SUBMISSIONS theo attempt_no→chi tiết 1 dòng) + rewiring resubmission-request dialog lên FK mới
- [x] Phase 7: Cleanup + validation cuối theo Success Criteria checklist (in progress — see Session Notes)

## Research Summary

- **Migration approach:** SQL migration thủ công 2 giai đoạn trong transaction (backfill trước, `ADD CONSTRAINT ... NOT VALID` rồi `VALIDATE CONSTRAINT` riêng để tránh khóa bảng lâu). Dry-run script riêng chỉ SELECT COUNT đối chiếu trước khi chạy INSERT thật (cả 2 researcher đồng thuận).
- **attempt_no race condition:** dùng Postgres RPC `SECURITY DEFINER` với advisory lock (`pg_advisory_xact_lock`) khóa theo hash của `(class_student_id, class_lab_id)` — không dùng row lock, vì lần nộp đầu tiên chưa có dòng `SUBMISSIONS` nào để lock. Trong cùng transaction: tính `attempt_no = COALESCE(MAX(attempt_no), 0) + 1`, tính `status` theo ngưỡng ≥5.0, rồi INSERT dòng mới. Bắt buộc vì Supabase JS client không transaction đa-statement. `UNIQUE(class_student_id, class_lab_id, attempt_no)` là safety net. RPC phải expose để cả C# (repo `be`) gọi được qua Supabase client/REST RPC endpoint.
- **Rollout compat (FR-19):** chọn phương án tạm dừng sync tool trong lúc migrate rồi redeploy `be` ngay sau — KHÔNG dựng compat view/trigger, vì view sẽ đánh dấu sai mọi write cũ thành `item_type='resubmit'`, làm sai lệch giới hạn 3 lần và breakdown đếm chấm lại.
- **RLS:** tham khảo pattern JWT claim hiện có ở `docs/api/2026-07-01-admin-student-access.sql` (auth.uid() → STUDENTS.auth_user_id hoặc email claim); `SUBMISSIONS` filter theo `class_student_id` join tới danh tính đăng nhập — khai báo lại tường minh, không thừa hưởng rule bảng `submissions` cũ.
- **be repo:** .NET/EF Core riêng biệt (`GradingSystem.Api/Application/Worker`), CI/CD tách biệt hoàn toàn với repo này. Upsert logic hiện ở `GradingSystem.Application/Services/AssignmentService.cs`, entrypoint `GradingSystem.Api/Controllers/SubmissionsController.cs`. Thay đổi FR-09 KHÔNG nằm trong cùng PR/commit với repo view — cần theo dõi và deploy riêng, có coordination thủ công.
- **FE rebuild risk:** tách phase schema+migration độc lập trước, rebuild FE sau khi migration confirm đúng, tránh debug đồng thời 2 việc. Không cần feature flag — dùng maintenance-mode banner ngắn.
- **Route structure:** App Router nested dynamic segments, ví dụ `app/admin/terms/[termId]/classes/[classId]/labs/[classLabId]/students/page.tsx`, `app/student/labs/[classLabId]/page.tsx` (danh sách dòng `SUBMISSIONS` theo `attempt_no`), `app/student/labs/[classLabId]/submissions/[submissionId]/page.tsx`. Giữ Server Actions pattern, raw supabase client (không ORM).
- **File hiện có liên quan:** `lib/actions/admin.ts`, `lib/actions/grades.ts`, `lib/actions/resubmissions.ts`, `lib/server/supabase.ts`, `docs/api/2026-07-01-admin-student-access.sql`, `docs/api/2026-07-01-resubmission-requests.sql`, `app/admin/student-results/page.tsx`.

## Dependencies

- Repo `be` (.NET) tại `/Users/ngothanhdat/Documents/CODE/prn232/prn232-auto-grader/be` — thay đổi FR-09 nằm ngoài working directory hiện tại, cần PR/deploy riêng, phối hợp thời điểm với Phase 2/3.
- Supabase project chung giữa repo view và repo `be` — mọi thay đổi schema ảnh hưởng cả 2 phía cùng lúc.
- Người có quyền dừng/khởi động lại sync tool `be` (coordination thủ công ở Phase 2 và Phase 3) — cần xác nhận ai thực hiện và khi nào trước khi chạy migration thật.
- Google Drive link / Discord webhook config hiện có cho luồng resubmission — giữ nguyên, không đổi.

## Risks

- HIGH: Migration chạy sai trên production Supabase gây mất dữ liệu điểm cũ — Mitigation: bắt buộc dry-run (chỉ SELECT COUNT đối chiếu) chạy và review trước khi apply script INSERT thật; backup/snapshot Supabase trước khi migrate.
- HIGH: Sync tool `be` cũ ghi UPSERT sai vào schema mới trong khoảng giữa 2 lần deploy nếu quên freeze — Mitigation: liệt kê rõ bước freeze/resume thủ công trong Phase 2/3, xác nhận bằng người phụ trách trước khi chạy migration, không dùng compat view.
- HIGH: `attempt_no` bị trùng do race condition khi 2 lần chấm chạy gần nhau — Mitigation: RPC `SECURITY DEFINER` với advisory lock (`pg_advisory_xact_lock` theo hash `(class_student_id, class_lab_id)`) + `UNIQUE(class_student_id, class_lab_id, attempt_no)` làm safety net.
- MEDIUM: `lab_id`/`lab_code` không nhất quán (hoa/thường, tên đầy đủ vs rút gọn) khiến map sai sang `LABS.id` — Mitigation: bước chuẩn hóa format riêng (FR-08) trước khi map, kèm review thủ công danh sách lab distinct trước khi insert.
- MEDIUM: RLS mới viết sai khiến student đọc được dòng `SUBMISSIONS` của người khác hoặc bị chặn đọc của chính mình — Mitigation: viết test case RLS cụ thể theo từng role trước khi enable trên production, tham khảo pattern JWT claim đã có.
- LOW: FE rebuild admin/student dashboard tốn effort lớn nhưng không có feature flag để rollback từng phần — Mitigation: dùng maintenance-mode banner ngắn thay vì flag, review kỹ trước khi merge, giữ route cũ đọc-only tạm thời nếu cần fallback nhanh.

**Ghi nhận từ plan-reviewer (2026-07-04):**
- ACCEPTED, đã sửa trong phase file: FR-16 (status per-item ≥5.0) thiếu bước triển khai → bổ sung vào Phase 1 bước 4/5 + Success Criteria.
- ACCEPTED, đã sửa: Phase 1 success criterion "chặn yêu cầu thứ 4" không testable ở Phase 1 (logic thật nằm ở Phase 6) → reword lại criterion Phase 1, giữ nguyên implementation ở Phase 6.
- ACCEPTED, đã sửa: thiếu bước backup/snapshot Supabase tường minh trước khi apply migration thật → thêm thành bước bắt buộc riêng trong Phase 2 (bước 4) + Success Criteria.
- ACCEPTED, đã sửa: hành vi job chấm bài gửi đến `be` trong lúc freeze (mất hay queue lại) không được xác định → bổ sung vào Phase 2 bước 3.
- NOTED, theo dõi khi thực thi: kiểm tra giới hạn 3 lần chấm lại (Phase 6) ban đầu là check-then-act không khóa như attempt_no → đã sửa thành yêu cầu cùng RPC advisory-lock, xem Phase 6 bước 6.
- NOTED, theo dõi khi thực thi: Phase 2 bước insert `attempt_no=1` trực tiếp (bỏ qua RPC) cần ghi rõ là ngoại lệ có chủ đích chỉ áp dụng lúc freeze — đã bổ sung ghi chú trong Phase 2 bước 6.
- NOTED, theo dõi khi thực thi: RLS (Phase 4) chưa có bước rollback nhanh nếu lỗi phát hiện sau khi enable — đã bổ sung mục Rollback vào Phase 4.
- NOTED, chấp nhận là rủi ro vận hành không thể pin down trước: xác nhận có team riêng vận hành `be` (không phải cùng người), nhưng CHƯA có tên/kênh liên hệ cụ thể — phải chốt trước khi thực thi Phase 2 bước 3. Job đến trong lúc freeze được xác nhận xử lý theo kiểu "vào queue, worker tạm dừng, replay sau" (không bị từ chối) — đã cập nhật vào Phase 2 bước 3.
- Phase 3 (sửa sync tool `be`) được xác nhận NẰM NGOÀI phạm vi phiên `/ck:cook` áp dụng cho plan này, vì repo `be` ngoài working directory hiện tại — cần chạy `/ck:cook` riêng, trỏ vào repo `be`, sau khi Phase 1/2 của plan này hoàn tất và trước khi resume sync tool.
- **Cập nhật 2026-07-04 (sau red-team):** mô hình dữ liệu đổi từ 2 bảng Order/OrderItem (`SUBMISSIONS`+`SUBMISSION_ITEMS`) sang 1 bảng phẳng duy nhất `SUBMISSIONS` (FK trực tiếp `class_student_id`+`class_lab_id`, phân biệt bằng `attempt_no`), theo yêu cầu người dùng. Lý do: `CLASS_STUDENTS` đã đủ vai trò nhóm theo sinh viên+lớp, không cần tầng "đơn" trung gian. Cơ chế khóa đổi từ row-lock trên dòng order sang Postgres advisory lock trên hash `(class_student_id, class_lab_id)`, vì ở mô hình phẳng có thể chưa tồn tại dòng nào để lock ở lần nộp đầu tiên. Toàn bộ 7 phase file đã được cập nhật lại theo mô hình này (xem spec.md để biết chi tiết đầy đủ).

**Ghi nhận từ plan-reviewer, vòng 2 — red-team mô hình phẳng (2026-07-04):**
- ACCEPTED, đã sửa: spec.md còn sót 1 dòng acceptance criterion (P2 migration story) liệt kê `SUBMISSION_ITEMS` đã không còn tồn tại → đã xóa khỏi spec.md.
- ACCEPTED, đã sửa: chưa có RPC riêng cho việc đếm-và-tạo yêu cầu chấm lại nguyên tử (Phase 6 bước 6 trỏ nhầm vào RPC sinh `attempt_no` của Phase 1, vốn khác mục đích) → bổ sung RPC `SECURITY DEFINER` thứ hai ở Phase 1 bước 7, dùng cùng advisory lock key, Phase 6 bước 6 cập nhật để gọi đúng RPC này.
- ACCEPTED, đã sửa: giới hạn 3 lần chấm lại có thể bị lách nếu chỉ đếm dòng `resubmit` đã hoàn tất (bỏ qua request đang `pending`/`approved`) → RPC đếm ở Phase 1 bước 6/7 giờ tính cả request chưa hoàn tất lẫn dòng `SUBMISSIONS.item_type='resubmit'` đã có.
- ACCEPTED, đã sửa: `RESUBMISSION_REQUESTS.created_submission_id` được định nghĩa trong schema nhưng chưa phase nào ghi giá trị cho nó → RPC sinh `attempt_no` ở Phase 1 bước 5/8 nhận thêm tham số tùy chọn `fulfills_request_id`, tự cập nhật cột này khi được truyền; Phase 3 bước 1 cập nhật để truyền tham số này khi hoàn tất 1 yêu cầu chấm lại.
- ACCEPTED, đã sửa: Phase 2 bước 6 (backfill dữ liệu cũ) không nêu rõ cách tính `item_type` cho dòng `attempt_no=1` được tạo từ dữ liệu cũ, dễ mặc định sai thành `original` → bổ sung yêu cầu tính theo `submitted_at` vs `CLASS_LABS.deadline`, cùng quy tắc với lượt chấm mới.
- NOTED, theo dõi khi thực thi Phase 3: RPC sinh `attempt_no` chưa có cơ chế idempotency cho trường hợp `be` tool retry sau timeout (có thể tạo `attempt_no` giả nếu INSERT đã commit trước khi response về) — cân nhắc thêm idempotency key (`job_id` duy nhất mỗi lượt chấm thật) nếu vấn đề này xuất hiện trong theo dõi thực tế ở Phase 3 bước 6; không bổ sung ngay vì risk thấp và chưa có bằng chứng cụ thể.
- Verdict tổng thể: PASS-with-notes (không có finding CRITICAL/security chặn Phase 1/2; 4 finding HIGH đã được sửa trực tiếp vào phase file trước khi cook).

## Session Notes
<!-- Updated by cook automatically — do not edit manually -->

**Last active:** 2026-07-04 (Phase 7 continuation)
**Phase in progress:** phase-07-cleanup-validation
**Status:** Success Criteria re-verified against code; old admin route redirected; docs review in progress

### Success Criteria checklist (spec.md) — re-verified this session

- [x] Admin xem kỳ→lớp→sinh viên→số lần chấm lại trong 1 lượt tải — `admin_class_lab_student_results(p_class_lab_id)` RPC (`docs/api/2026-07-04-normalize-erd-admin-queries.sql`) returns per-student `attempt_count`/`resubmit_count`/latest score in one grouped query; consumed by `getClassLabStudentResultsAction` → students page. Verified at code/type level; no live Supabase project in this environment to run the query against real data.
- [x] Student mở 1 lab xem toàn bộ lịch sử `SUBMISSIONS` — `getClassLabAttemptsAction` → `app/student/labs/[classLabId]/page.tsx` lists every attempt ordered by `attempt_no`, not just latest. Verified at code level only.
- [ ] Migration dry-run/apply row counts match — scripts exist (`docs/api/2026-07-04-migration-dry-run.sql`, `-apply.sql`, `-reconcile.sql`) but have NOT been run against a live Supabase project in this session (none available). **Pending actual execution before this criterion can be marked done.**
- [ ] Sync tool ở repo `be` tạo 2 dòng `SUBMISSIONS` phân biệt cho 2 lần chấm — depends on Phase 3, explicitly out of scope for this session/repo. **Blocked on separate `/ck:cook` run in the `be` repo.**
- [x] Yêu cầu chấm lại lần thứ 4 bị chặn với cảnh báo rõ — `create_resubmission_request()` RPC (`docs/api/2026-07-04-normalize-erd-schema.sql:225`) raises `resubmission_limit_reached` on the 4th `resubmit`-type row; `erd-student.ts`'s `createResubmissionRequestAction` catches it and returns a friendly "max 3 per lab" message. Verified at code level only.
- [x] 1 lab trong catalog gán cho lớp kỳ A, không bắt buộc gán kỳ B — structural by design: `class_labs` is a join row per `(class_id, lab_id)`; `assignLabToClassAction` only inserts a row for the class explicitly chosen, `labs` catalog itself carries no term/class reference. No code path forces cross-term assignment.

**Caveat applying to all "verified at code level" items above:** this environment has no live Supabase project with the new schema applied, so verification is `tsc`/`eslint`/manual-reasoning only — not an executed end-to-end check. Flagged per the user's earlier explicit choice to proceed without live-DB testing.

### Decisions made this session
- Confirmed `app/admin/student-results/page.tsx` redirect (done in a prior segment) satisfies the "no string-based admin route" success criterion — kept as a redirect rather than deleting, per Phase 7's general risk guidance against removing things rashly.
- Did not fabricate migration row-count numbers for the "0 data loss" criterion — recorded as pending real execution instead, consistent with Phase 7 step 6's instruction to document this as future work rather than invent numbers.

### ck:cook pipeline results
- **Step 3 (tester, mandatory under `--hard`):** 33/33 tests pass (30 new: `lib/actions/erd-student.test.ts`, `lib/actions/erd-admin.test.ts`, `components/student/AttemptResubmissionDialog.test.ts`, using Vitest with hand-mocked Supabase client — no live DB available). Verified control-flow only (guards, error mapping, no-default-lab UI requirement); explicitly could NOT verify real RLS behavior or real PostgREST query syntax.
- **Step 4 (code-reviewer, mandatory under `--hard`, no auto-approve):** Verdict **WARNING** — one HIGH finding: `getCurrentClassStudentIdAction` (`lib/actions/erd-student.ts:42`) used an invalid PostgREST `.order("classes(terms(starts_on))")` call (compound path as column name is not valid postgrest-js syntax) which would throw or silently misorder against a real Supabase endpoint — exactly the kind of bug the mocked test suite couldn't catch. **Fixed**: changed to `.order("starts_on", { referencedTable: "classes.terms", ascending: false })`, matching the real `postgrest-js` type signature (confirmed via `node_modules/@supabase/postgrest-js/dist/index.d.mts:1152-1156`). Re-ran `tsc`/`eslint`/`vitest` after the fix — all clean (0 errors, 33/33 tests still passing). All other review dimensions (admin `requireAdmin()` coverage on all 10 exports, RLS default-deny posture + service-role-bypass documented as the real boundary, 3-attempt-cap vs. rate-limit separation, explicit-lab-selection dialog) passed with no findings.
- **Awaiting human approval** to proceed to Step 5 (finalize) per `--hard` mode's "no auto-approve" rule — the WARNING has been remediated but a human sign-off is still required before project-manager/docs-manager/git-manager run.

### Next immediate action
Get user approval on the code-review fix, then run ck:cook Step 5 (project-manager → docs-manager → git-manager) to finalize.
