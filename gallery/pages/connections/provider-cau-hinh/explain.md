---
title: Kết nối › tài khoản › Cấu hình (khuôn trang provider)
route: /workspaces/<ws>/connections/open/<id>
area: connections
---
# Trang provider › tab Cấu hình

Ảnh chụp từ các Base thật với câu trả lời mẫu của `providerTriggerStates` (T0) trên route thử tạm đã xoá; không đăng nhập, không có sidebar console, không gọi back end. Phần "Kết nối" bên trái dùng thẻ chi tiết mẫu (nội dung thật của tab lấy từ hàng kết nối, không chụp được khi chưa đăng nhập). Hình mẫu: `lanes/drawings/provider-docs-config.png` phần `tab "Cấu hình" (mở đầu tiên)`. Các ảnh biến thể `-chon-agent`, `-nhieu-trigger`, `-chua-co-trigger`, `-chi-doc`, `-loi` vẽ thẻ Trigger cũ ở tab này: đã lỗi thời, chụp lại ở tab Trigger.

## Hai cột trên nền hồng
Vì sao: kết nối và nội dung riêng của tài khoản ở trái, sự kiện trực tiếp của provider ở phải; công tắc trigger KHÔNG còn ở đây, chúng nằm đúng một nơi là tab Trigger (../provider-trigger/explain.md). Chrome (dải đầu, tab) là mặt phẳng, chỉ vùng giữa là nền hồng, các khối nổi riêng bên trong.
Luật: `pink-page-surface-rule`
Grammar: `Grid kind="pair"`, node_modules/@starci/grammar/dist/core/frame/Grid/index.d.ts

## Cột trái: kết nối
Vì sao: nội dung cũ của trang tổng quan giữ nguyên (cảnh báo, ghi chú, bảng SMTP, khoá, thẻ chi tiết, băng agent khi có); không thêm trường nào API không có. Bản vẽ có ô "Tên hiển thị / Số tài khoản / Khoá API" kèm dòng "Được niêm phong, không hiện lại": trang chung chưa có biểu mẫu trường nào như vậy nên chưa vẽ.
Luật: `blocks-are-real-code`, `surfacecard-select-subtitle`

## Còn khác hình vẽ
- Nhãn "Kết nối" và các ô tên / số tài khoản / khoá API, dòng "Được niêm phong, không hiện lại", nút "Lưu": chưa có biểu mẫu hay hành động nào trên trang chung nên chưa vẽ. Dải đầu giữ nút lệnh chính của hàng kết nối (ví dụ "Kiểm tra" khi hàng có) và menu.

## Gấp SePay, Zalo OA, Telegram vào khuôn này (không có ảnh chụp)
Các trang riêng `connections/{sepay,zalo,telegram}/<id>` đã bỏ; địa chỉ cũ chuyển hướng về `connections/open/<id>` (`?view=agents` về tab Quyền, còn lại về Cấu hình). `connectionPageHref` và `zaloConnectionHref` trỏ thẳng khuôn. Khối `ProviderConfigTab` chọn nội dung theo provider; cột phải là sự kiện (thẻ Trigger đã chuyển sang tab Trigger).
- SePay: cột trái = thông báo, 5 bước cài (môi trường, tài khoản, webhook + khoá API, thử, agent kế toán), sức khoẻ/chi tiết, băng agent; cột phải = sự kiện webhook.
- Zalo OA: thông báo, 5 bước cài, mẫu ZNS, chi tiết, băng agent; sự kiện.
- Telegram: thông báo, 4 bước cài, chi tiết, băng agent; sự kiện.
- Còn lại (SMTP, webhook, nguồn dữ liệu, ...): hàng kết nối cũ (cảnh báo, ghi chú, SMTP, khoá), chi tiết, băng agent khi có; sự kiện.
Ảnh chụp thật của ba provider chưa có: các khối này đọc trực tiếp từ API sau đăng nhập (không có đăng nhập, không dựng được dữ liệu mẫu mà không viết bản sao).

## Ảnh còn thiếu
Tab Cấu hình của SePay / Zalo OA / Telegram / mail ở 1440 và 390 sau khi bỏ thẻ Trigger (cột phải chỉ còn sự kiện); các ảnh `provider-cau-hinh*` hiện có vẽ thẻ Trigger cũ.
