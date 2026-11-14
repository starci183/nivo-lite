---
title: Kết nối › Google Drive › Cấu hình (trang tài khoản trên khuôn provider)
route: /workspaces/<ws>/connections/open/<id>
area: connections
---
# Trang provider › tab Cấu hình, tài khoản Google Drive

Trang riêng cũ của Google (tab Dịch vụ · Sự kiện · Agent · Cài đặt, route `/connections/google`) đã bỏ. Tài khoản Google Drive mở trên khuôn provider chung như mọi provider: tab Cấu hình · Quyền · API · MCP · Trigger. Địa chỉ `/connections/google` giờ là trang danh sách của provider Google (route `[provider]`, gồm cả tài khoản Drive và tài khoản Sheets). Chưa có ảnh chụp: shots missing (1440, 390), phải chụp lại ở pha 2. Các ảnh `1440.png`, `390.png` trong thư mục này vẫn là trang cũ.

## Dải đầu trang (ConnectionOpenHead)
Vì sao: một dải cho mọi tài khoản: đường dẫn Kết nối › Google › tên tài khoản, tên, chip trạng thái, lệnh của dòng (kết nối lại / ngắt kết nối trong menu ⋯, ngắt hỏi lại trước), năm tab. Ngắt kết nối Drive đi qua quyền đã cấp (xoá cả khoá đã lưu), không còn nút riêng trong dải.
Luật: `page-header-left-sublabel-xs.md`, `red-budget-links-foreground.md`.
Grammar: `PageHeader tabs`, `AlertDialog`.

## Thẻ "Kết nối" (tên hiển thị)
Vì sao: cùng thẻ form của mọi tài khoản; Drive không có trường bí mật nào.
Luật: `row-control-clearance.md`.

## Các bước thiết lập (Cấp quyền Google Drive · Chọn tài liệu · Tìm trong Second Brain)
Vì sao: giữ nguyên chức năng của trang cũ, chuyển vào Cấu hình như các bước của SePay / Zalo / Telegram: cấp quyền (cấp lại khi Google thu hồi), chọn thư mục hoặc tệp và nạp lần đầu (dán liên kết, chọn từ Drive, tích tệp đọc được), mở Second Brain. Sau khi Google đồng ý, người dùng quay lại đúng trang tài khoản này. Danh sách "Dịch vụ của tài khoản" (có Calendar và Gmail "sắp có") và thẻ thiết lập 4 mốc đã gỡ: lời hứa chưa có trong code, và mỗi dịch vụ giờ là một tài khoản riêng.
Luật: `table-heroui-native-section-head.md`, `surfacecard-select-subtitle.md`.
Grammar: `Stepper` (composite `ConnectionSteps`), `Button endArrow`.

## Thông tin kết nối
Vì sao: quyền đã cấp (chỉ đọc), tài khoản Google, số tài liệu đã nạp, lần đọc gần nhất, dung lượng đã dùng. Chỉ những gì be báo; không có ngày thêm hay người thêm.
Luật: `table-heroui-native-section-head.md`.
Grammar: `DescriptionList`, `SurfaceCard kind="details"`.

## Agent dùng kết nối này
Vì sao: vùng chung của khuôn: các agent đã gắn, gỡ và gắn thêm; quyền chi tiết xem ở tab Quyền (chỉ đọc).
Luật: `row-padding`, `suggestion-button-sm.md`.

## Cột phải: Tiến độ nạp (Trigger + tệp đang đọc)
Vì sao: cột phải của khuôn có thẻ Trigger; dưới nó là danh sách tệp đang đọc từ Drive và trạng thái từng tệp (đọc lại mỗi vài giây vì Drive không có webhook). Google chưa khai báo trigger trong danh mục provider của be, nên thẻ Trigger nói chưa có; danh sách tệp là thông tin, không phải trigger. Thẻ trống không còn nút riêng: lệnh kế tiếp nằm ngay ở các bước bên trái.
Luật: `nivo-surface-layering.md`, ui-laws "EmptyNotice on a pane is frameless".

## Các tab Quyền · API · MCP · Trigger
Vì sao: lấy từ sổ đăng ký provider, không gọi tài khoản. Nếu sổ chưa có tài liệu cho `google_drive` thì mỗi tab hiện trạng thái trống của khuôn ("Provider này chưa có"), không bịa nội dung.
