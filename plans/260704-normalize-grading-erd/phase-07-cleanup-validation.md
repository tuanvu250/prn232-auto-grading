# Phase 7: Cleanup + validation cuối

## Requirements

Xác nhận toàn bộ Success Criteria trong spec đã đạt, dọn dẹp phần còn sót lại của schema/route cũ đã không còn dùng, và đóng vòng phối hợp với repo `be`.

Map tới user story: [P2] admin muốn migration không mất dữ liệu (xác nhận cuối cùng), đóng lại toàn bộ P1 stories đã rebuild ở các phase trước.

## Steps

1. Chạy lại toàn bộ checklist Success Criteria trong spec.md, xác nhận từng mục pass bằng kiểm tra thủ công hoặc câu truy vấn đối chiếu.
2. Xác nhận không còn route/trang FE nào (admin hoặc student) còn tham chiếu đến schema cũ (`allowed_emails`/`submissions`/`resubmission_requests` dạng cột chuỗi cũ).
3. Sau khi xác nhận migration đã ổn định và FE mới chạy đúng trên production một thời gian, lên kế hoạch loại bỏ/lưu trữ (archive) các bảng cũ không còn dùng — không xóa vội nếu chưa chắc chắn.
4. Xác nhận với người phụ trách repo `be` rằng sync tool mới đã chạy ổn định, không còn thao tác thủ công tạm dừng/nối lại nào bị treo.
5. Rà soát lại toàn bộ tài liệu (docs/api) liên quan đến schema cũ, cập nhật hoặc đánh dấu lỗi thời để tránh nhầm lẫn cho người sau.
6. Ghi lại kết quả migration cuối cùng (số dòng trước/sau, các trường hợp trùng lặp đã biết) để tham chiếu về sau nếu có tranh chấp dữ liệu.

## Success Criteria

- Toàn bộ 6 mục Success Criteria trong spec.md được đánh dấu đã pass với bằng chứng cụ thể (query hoặc thao tác thủ công đã thực hiện).
- Không còn đoạn code FE/BE nào (trong phạm vi repo này) tham chiếu trực tiếp đến cột/bảng schema cũ.
- Có xác nhận cuối cùng từ người phụ trách repo `be` rằng sync tool mới đang chạy ổn định trên production.
- Tài liệu liên quan trong `docs/api` phản ánh đúng schema mới, không còn hướng dẫn dựa trên bảng cũ gây nhầm lẫn.

## Risks

- Xóa bảng cũ quá sớm trong khi vẫn còn phụ thuộc ẩn (báo cáo thủ công, script nội bộ khác): chỉ archive/rename thay vì xóa ngay, giữ ít nhất 1 chu kỳ vận hành trước khi xóa hẳn.
- Bỏ sót 1 route FE cũ vẫn còn được truy cập ngầm, gây lỗi 500 âm thầm sau khi bảng cũ bị dọn: rà soát toàn bộ codebase tìm tham chiếu tên bảng cũ trước khi archive.
