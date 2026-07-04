# Phase 2: Migration script — dry-run + apply + freeze sync tool

## Requirements

Chuyển toàn bộ dữ liệu sản xuất hiện có (danh sách email cho phép, bài nộp cũ, yêu cầu chấm lại cũ) sang cấu trúc mới đã tạo ở Phase 1, không mất bản ghi nào, và đảm bảo trong lúc chuyển đổi không có ghi đè sai từ tool chấm cũ đang chạy song song.

Map tới user story: [P2] admin muốn dữ liệu cũ (roster, điểm, yêu cầu chấm lại) được migrate không mất mát.

## Steps

1. Chuẩn hóa định dạng mã lab hiện có (viết hoa/thường, tên đầy đủ vs rút gọn không nhất quán) thành 1 format thống nhất, làm cơ sở map sang catalog lab mới.
2. Viết kịch bản đối chiếu số lượng (dry-run): chỉ đếm và so sánh — không ghi dữ liệu — giữa số dòng cũ (email cho phép, bài nộp, yêu cầu chấm lại) và số dòng dự kiến sẽ tạo ra ở schema mới, chạy thử trên bản sao/staging trước.
3. Điều phối thời điểm dừng tạm sync tool cũ ở repo `be` với team vận hành `be` (repo/CI/CD riêng, không cùng team với repo này) — cần chốt tên/kênh liên hệ cụ thể của người xác nhận trước khi thực thi phase này, chưa có ở thời điểm lập plan. Job chấm bài gửi đến `be` trong lúc freeze **không bị từ chối** — vẫn được nhận vào hàng đợi (queue) như bình thường, chỉ tạm dừng worker xử lý; sau khi resume, worker xử lý lại toàn bộ job đang chờ trong queue theo logic sync tool mới (FR-09), không mất job nào.
4. Lấy/xác nhận có bản backup hoặc snapshot Supabase khôi phục được (point-in-time recovery hoặc snapshot thủ công) **trước khi chạy bước apply thật** — đây là bước bắt buộc, không phải tùy chọn, vì migration thao tác trực tiếp lên dữ liệu điểm sản xuất không thể phục hồi nếu sai.
5. Sau khi có xác nhận sync tool đã dừng và backup đã sẵn sàng, chạy migration thật trong 1 giao dịch: suy ra đúng 1 kỳ học hiện tại và gán toàn bộ lớp học suy từ tên lớp cũ vào kỳ đó; chuyển danh sách email cho phép thành sinh viên + quan hệ sinh viên–lớp; mỗi mã lab duy nhất thành 1 dòng catalog lab, gán cho đúng lớp tương ứng.
6. Với mỗi cặp (sinh viên, lab) đã từng có bài nộp cũ, tạo trực tiếp 1 dòng `SUBMISSIONS` với `attempt_no = 1` (không thể tái tạo lịch sử các lần ghi đè đã mất trước đây). Tính `item_type` cho từng dòng theo cùng quy tắc dùng cho lượt chấm mới (FR-04): so sánh `submitted_at` của bản ghi cũ với `CLASS_LABS.deadline` đã map ở dòng đó — nộp trước deadline thì `original`, sau deadline thì `late` — không mặc định toàn bộ dòng backfill là `original`. Dòng này được insert trực tiếp, **không** qua RPC khóa ở Phase 1 — đây là ngoại lệ an toàn có chủ đích, chỉ đúng vì sync tool cũ đã dừng hoàn toàn (không có tiến trình ghi đồng thời nào khác trong lúc migrate); không dùng cách insert trực tiếp này ở bất kỳ chỗ nào khác ngoài migration một lần này.
7. Nối lại yêu cầu chấm lại cũ vào đúng dòng `SUBMISSIONS` tương ứng (`submission_id`) ở schema mới.
8. Áp dụng ràng buộc toàn vẹn dữ liệu (khóa ngoại) theo cách không khóa bảng lâu — xác thực trước khi ràng buộc chính thức có hiệu lực, để tránh downtime kéo dài trên bảng lớn.
9. Chạy lại kịch bản đối chiếu số lượng sau khi migrate xong, so với số liệu dry-run ban đầu, xác nhận khớp (trừ trùng lặp hợp lệ đã biết trước).

## Success Criteria

- Kịch bản dry-run chạy xong và in ra bảng so sánh số dòng trước/dự kiến sau mà không ghi bất kỳ dữ liệu nào.
- Backup/snapshot Supabase khôi phục được đã được xác nhận tồn tại trước khi bước apply thật chạy — có ghi chú thời điểm và cách khôi phục nếu cần.
- Sau khi apply thật, số lượng sinh viên/catalog lab/dòng `SUBMISSIONS`/yêu cầu chấm lại ở schema mới khớp với số liệu suy ra từ dữ liệu cũ.
- Có xác nhận bằng văn bản/tin nhắn ghi lại thời điểm sync tool cũ được dừng và thời điểm migration thật bắt đầu chạy.
- Dữ liệu cũ (bảng gốc) vẫn còn nguyên vẹn sau migration, chưa bị xóa (chờ xác nhận ở phase cleanup cuối).

## Risks

- Chạy migration thật khi sync tool cũ chưa thực sự dừng, gây ghi đè/tạo sai dữ liệu song song: bắt buộc có xác nhận thủ công rõ ràng từ người phụ trách trước khi chạy bước apply, không tự động hoá bước dừng/tiếp tục.
- Dữ liệu lab_id/tên lớp không sạch như giả định, gây map sai: review thủ công danh sách giá trị duy nhất trước khi chạy bước map chính thức, dừng lại xin xác nhận nếu phát hiện bất thường.
- Migration thật thất bại giữa chừng để lại dữ liệu nửa vời: chạy trong 1 giao dịch có thể rollback toàn bộ nếu có lỗi trước khi validate ràng buộc.
