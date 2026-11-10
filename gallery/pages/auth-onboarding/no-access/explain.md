---
title: Không có quyền truy cập (/no-access)
route: /no-access
area: auth-onboarding
---
# /no-access

Ảnh 1440/390 được khôi phục từ `gallery/shots` (bản `after` ngày 2026-11-09, trước khi Grammar 0.37.14 đổi link); chưa chụp lại: cần trạng thái (người dùng chưa có workspace / không có quyền; một URL lạ khi đã đăng nhập chỉ cho trang 404 mặc định của Next). Đã khôi phục, không có 1920.

Old entry point: it renders the same page as `workspaces` with a cautionary Alert about why the person landed here. Superseded by the canonical folder `workspaces`; every region is explained there. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Thông báo "Bạn chưa thuộc workspace nào. Hãy nhờ chủ sở hữu mời bạn."
Vì sao: SAI — (partly right, see the flagged part) the reason for the redirect is an Alert in the well above the list, correct as a state notice. The shot contradicts the text: the list below already shows a workspace (NIVO), so this screen was shot with data that makes the message false (SAI of the shot, take it with a user who has no workspace; then the welcome card should show).
Luật: `pink-page-surface-rule.md`, `verify-against-visualize.md`.
Grammar: `Alert tone="cautionary"`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts`.

## Phần còn lại của trang (thanh trên, dải đầu trang, bảng, khối tham gia)
Vì sao: SAI — identical to `workspaces` including its defects (count not a chip, "Mở →" with an icon on a sm button, "Link mới" single field in a card with a loose caption, two logo variants); see `workspaces/explain.md`.
Luật: `table-heroui-native-section-head.md`, `surfacecard-select-subtitle.md`.
Grammar: `WorkspaceShell`, `DataTable`, `node_modules/@starci/grammar/dist/core/branch/DataTable/index.d.ts`.
