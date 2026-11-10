# Phiên bản: hộp xác nhận quay lại (accounting)

<!-- shown -->
Màn này đang hiển thị quy trình "Đối soát tiền về" (`reconcile`, Bản 1, 5 bước): Có việc mới, Khớp tiền với đơn, Đánh dấu đã trả, Ghi sổ, Báo đội tiền về. Hộp xác nhận chỉ mở được khi có từ 2 bản trở lên (nút "Quay lại bản này" ở bản không chạy); quy trình này mới có một bản đang chạy nên ảnh trong thư mục này CHƯA chụp lại, là ảnh của lần chụp trước.
<!-- /shown -->

## Hộp xác nhận "Quay lại bản N?"
Vì sao: quay lại một bản cũ đổi quy trình đang chạy nên cần xác nhận rõ ràng trước khi làm; bản đang chạy vẫn nằm trong lịch sử.
Luật: workflow-memory-contracts.md (đổi quy trình là một bản mới có thể khôi phục), CTA-4 hành động phá huỷ hoặc đổi trạng thái phải xác nhận.
Grammar: `AlertDialog` (title, description, confirmLabel, cancelLabel, onConfirm), node_modules/@starci/grammar/dist/core/frame/AlertDialog/index.d.ts.
