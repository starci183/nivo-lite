---
title: Nhà phát triển (webhook, kết nối Claude, khóa API, hướng dẫn nhanh)
route: /workspaces/<ws>/developers
area: team-permissions
---
# Nhà phát triển (developers)

Chỉ chủ shop và quản lý; nhân viên đọc thông báo "không có quyền" tại chỗ. Lối vào là mục "Nhà phát triển" cuối nhóm Thiết lập của sidebar (chỉ chủ và quản lý thấy), cùng tên với tiêu đề trang. Bản vẽ: `lanes/contacts-20261113/api-keys-drawing.md`. Shots missing (chưa có stack): 1440 và 390.

## Dải đầu trang
Vì sao: breadcrumb Tổng quan / Nhà phát triển, tiêu đề và mô tả căn trái trên dải trắng; nền hồng chỉ ở vùng giữa.
Luật: `nivo-surface-layering`, `page-header-left-sublabel-xs`.
Grammar: `Page header`; app `components/blocks/DevelopersPanel/component.tsx`.

## Sự kiện gửi đi (webhook)
Vì sao: một Section có nhãn; nút "Thêm" trung tính ở đầu mục (khi đã có webhook), danh sách một thẻ, chấm trạng thái là trạng thái sống của kết nối. Câu giải thích là chú thích 12 muted dưới thẻ (`caption` của Section), không đứng cạnh nhãn.
Luật: `table-heroui-native-section-head`, `badge-dot-or-not`, `red-budget-links-foreground`.
Grammar: `Section kind="list"`, `Badge isDot`.

## Kết nối với Claude
Vì sao: SurfaceCard accordion: địa chỉ MCP (chép được), lệnh Claude Code, tệp .mcp.json, dòng về Claude Desktop; ghi chú dữ liệu ở chân thẻ. Nút Sao chép là `sm` trung tính, không icon.
Luật: `type-scale-14-12`, `red-budget-links-foreground`.
Grammar: `SurfaceCard kind="accordion"`, `FencedCodeBlock`; app `ClaudeConnectCard`.

## Khóa API
Vì sao: MỘT danh sách (nhãn loại trong từng dòng), chip đếm cạnh nhãn, chấm "Đang dùng / Đã thu hồi" là trạng thái sống, menu ⋯ Đổi tên / Thu hồi; nút "Tạo khóa" là CTA đỏ duy nhất của trang, có icon, nằm ở chân thẻ. Tạo / đổi tên là ngăn kéo ngắn; hai danh sách chọn là `SurfaceCard kind="select"`; khóa hiện một lần trong hộp thoại với Alert trung tính.
Luật: `surfacecard-select-subtitle`, `red-budget-links-foreground`, `complex-content-page-not-drawer`.
Grammar: `SurfaceCard kind="list|select"`, `Drawer`, `Dialog`, `AlertDialog`; app `ApiKeysSection`.

## Hướng dẫn nhanh
Vì sao: một thẻ accordion đóng, mở ra các ví dụ curl chép được.
Grammar: `SurfaceCard kind="accordion"`; app `ApiQuickStart`.
