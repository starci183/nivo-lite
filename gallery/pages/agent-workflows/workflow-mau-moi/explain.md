# Trang quy trình: thông báo "Mẫu có vN mới"

Hiện khi mẫu của quy trình có phiên bản mới hơn bản đang theo (`templateLatest > templateVersion`, đọc từ danh sách quy trình). Một `Alert` trung tính trên nền trang, trước phần nội dung: tiêu đề "Mẫu có v4 mới", dòng mô tả gồm changelog của mẫu và "Khác bản của bạn N bước" (từ `agentWorkflowTemplatePreview`), và một nút "Cập nhật theo mẫu" = `acceptAgentWorkflowTemplate` (một lời gọi, không có hộp thoại xin quyền; `rights.md`). Không cập nhật = bản cũ vẫn chạy (lời mời, không ép).

## Vì sao ở đây
Quy tắc: `contexts/ui/components/toast-alert.md` > `toast-alert.choose.owner` hàng "page" (việc cần người đọc chú ý: một `Alert` trên nền trang, trước phần tập hợp, HIERARCHY-3). Tông `neutral` (luật chủ: Alert thông tin trung tính; đỏ chỉ một CTA chính). Nút của Alert theo tông: neutral -> `alternative`, không accent.
Grammar: `Alert tone="neutral"` với `action`.

## Ghi chú
Grammar `Alert` chỉ có MỘT `action`, nên "Xem thay đổi" là một `Link` trong lời của thông báo (xem phần follow-up dưới đây); số bước khác và changelog nằm trong mô tả.

## Cập nhật (follow-up)
Đầu trang chỉ giữ MỘT `Button` (luật của `PaneHeader`): lệnh trạng thái. Hai icon "Sửa sơ đồ" / "Thêm bước" đã bỏ vì sơ đồ là của mẫu, không sửa. `page-header.md` Size: lệnh xuống dưới tiêu đề ở điện thoại là việc của Grammar, app không tự bọc.
"Xem thay đổi" nay là một `Link` trong lời của thông báo (`Alert.description` nhận ReactNode; `button.choose.role` hàng "text-action": đích đến đọc như một phần câu), dẫn tới trang `…/versions/preview/<vN>`; "Cập nhật theo mẫu" vẫn là action duy nhất. Link màu chính (luật chủ: link = màu primary đúng).
