# Trang quy trình: nút "Tạm dừng" (quy trình đang chạy)

Cùng một nút với "Bật", đổi chữ theo `head.toggleLabel` / `toggleTo` do view dựng từ trạng thái của API: đang chạy -> "Tạm dừng" (gửi `paused`). Tạm dừng đi thẳng một lời gọi `setAgentWorkflowStatus`, như "Bật".

## Vì sao ở đây
Giống `workflow-bat`: `page-header.choose.slot` hàng "command" + `button.choose.intent` hàng "neutral". Không đỏ: dừng một quy trình có thể bật lại, nên không phải `destructive`.
Grammar: `PaneHeader.actions`, `Button intent="neutral" size="sm"`.

## Cập nhật (follow-up)
Đầu trang chỉ giữ MỘT `Button` (luật của `PaneHeader`: "icon buttons and at most one Button"): lệnh trạng thái. "Sửa sơ đồ" / "Thêm bước" thành `IconButton` có nhãn và tooltip (bút / dấu cộng), nên ở 390 tiêu đề còn chỗ hơn. `page-header.md` Size: lệnh xuống dưới tiêu đề ở điện thoại là việc của Grammar, app không tự bọc.
