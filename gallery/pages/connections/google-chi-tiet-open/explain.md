---
title: Chi tiết Google Sheets (đang chạy)
route: /workspaces/<ws>/connections/open/<id>
area: connections
---
# Trang provider › tab Cấu hình, tài khoản Google (Sheets)

Cùng khuôn provider như mọi tài khoản (Cấu hình · Quyền · API · MCP · Trigger). Cấu hình của tài khoản Google gồm: thẻ Kết nối, nội dung dòng (cảnh báo, ghi chú), sổ cái trên Google Sheets (cấp quyền hoặc cấp lại, chọn bảng tính, mở bảng tính, dòng ghi gần nhất), thông tin kết nối, agent dùng kết nối này; cột phải: thẻ Trigger và sự kiện gần nhất. Các ảnh `1440.png`, `390.png` là bản cũ (tab Tổng quan / Sự kiện / Agent / Cài đặt); chưa có ảnh mới: shots missing.

## Khung console (thanh trên, thanh bên)
Vì sao: white console chrome, "Kết nối" current in the sidebar; theme toggle has no law behind it (CHƯA RÕ).
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`.

## Sổ cái trên Google Sheets
Vì sao: chuyển từ tab Cài đặt của trang Google cũ vào Cấu hình của tài khoản Google: sổ cái là việc có thật trong code (công cụ trạng thái sổ cái, ghi và đọc, của provider google). Sau khi cấp quyền, Google đưa người dùng về đúng trang tài khoản này.
Luật: `table-heroui-native-section-head.md`, `row-control-clearance.md`.
Grammar: `SurfaceCard`, `Button`.

## Các tab Quyền · API · MCP · Trigger
Vì sao: từ sổ đăng ký provider; Google chưa khai báo trigger nên tab Trigger nói chưa có.
