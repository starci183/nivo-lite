# Phiên bản: hộp xác nhận quay lại (sales)

## Hộp xác nhận "Quay lại bản N?"
Vì sao: quay lại một bản cũ đổi quy trình đang chạy nên cần xác nhận rõ ràng trước khi làm; bản đang chạy vẫn nằm trong lịch sử.
Luật: workflow-memory-contracts.md (đổi quy trình là một bản mới có thể khôi phục), CTA-4 hành động phá huỷ hoặc đổi trạng thái phải xác nhận.
Grammar: `AlertDialog` (title, description, confirmLabel, cancelLabel, onConfirm), node_modules/@starci/grammar/dist/core/frame/AlertDialog/index.d.ts.
