# Trang quy trình: nút "Bật" (quy trình nháp / tạm dừng)

Mới có: nút trung tính "Bật" ở dải đầu trang, đứng trước nút lệnh của phần đang mở ("Sửa sơ đồ" / "Thêm bước"). Bấm = `setAgentWorkflowStatus` (một lời gọi, không có hộp thoại xin quyền): bật ngay (toast "Đã đổi trạng thái quy trình"). Việc một workflow chưa chạy được vì thiếu provider hay luồng bị tranh không chặn nút này; thẻ "Chưa chạy được" trên tab Quy trình nói vì sao (`workflow-chua-chay-duoc`).

## Vì sao ở đây
Quy tắc: `contexts/ui/components/page-header.md` > `page-header.choose.slot` hàng "command" (lệnh của cả trang nằm ở `actions` của đầu trang, là `Button` theo intent, tối đa một commit) và `button.choose.intent` hàng "neutral" (lệnh ngoài quyết định chính, không dùng commit). Trạng thái "Nháp" / "Tạm dừng" vẫn là `Badge` có chấm cạnh tên (`status`, chip.choose.role: trạng thái sống), nên lệnh đổi trạng thái nằm ngay cạnh nó, cùng một dải.
Luật chủ: red-budget-links-foreground (trang không có nút đỏ thứ hai: cả hai nút đều neutral), verify-against-visualize (nút sm không có icon), type-scale-14-12.
Grammar: `PaneHeader` `actions` (qua `PaneHead`), `Button intent="neutral" size="sm"`, `Badge isDot`.

## Khác bản vẽ
Không có bản vẽ cho lệnh này; đây chỉ là một nút. Ảnh là dữ liệu mẫu có hình dạng như API; ảnh chụp chỉ phần pane (không có khung trang và thanh tab).

## Cập nhật (follow-up)
Đầu trang chỉ giữ MỘT `Button` (luật của `PaneHeader`: "icon buttons and at most one Button"): lệnh trạng thái. "Sửa sơ đồ" / "Thêm bước" thành `IconButton` có nhãn và tooltip (bút / dấu cộng), nên ở 390 tiêu đề còn chỗ hơn. `page-header.md` Size: lệnh xuống dưới tiêu đề ở điện thoại là việc của Grammar, app không tự bọc.

## Cập nhật 2026-11-13
Không còn hộp thoại xin quyền khi bật: máy chủ không chặn theo quyền (`rights.md`), nút chỉ đổi trạng thái. Ảnh cũ chưa liên quan hộp thoại.
