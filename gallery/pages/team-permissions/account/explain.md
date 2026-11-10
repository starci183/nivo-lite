---
title: Tài khoản của bạn / Tài khoản
route: /workspaces/<ws>/account
area: team-permissions
---
# Tài khoản của bạn, tab Tài khoản

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Blocks `AccountSignIn` (components/blocks/AccountSignIn/component.tsx) and `AccountSessions` (components/blocks/AccountSessions/component.tsx). Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Overlays ("1 Issue", red dot) are not content.

## Khung console, dải đầu trang và tab (Hồ sơ / Tài khoản)
Vì sao: SAI — white chrome; band with breadcrumb "Tổng quan / Tài khoản của bạn", title, sublabel, tab layer one (Hồ sơ, Tài khoản selected) all flush left, right; defects: the blank 64px pink strip above the band, and the first card is clipped under the sticky band (its top edge is cut).
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`, `page-header-left-sublabel-xs.md`.
Grammar: `PageHeader tabs`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Thẻ phương thức đăng nhập (Email đăng nhập, Google, Email và mật khẩu)
Vì sao: SAI — one list card with icon tile, noun title 14/500, 12 muted subtitle and a status chip on the right: correct list anatomy. Data contradiction: "Email và mật khẩu: Chưa liên kết" while the user signed in with that very email; and the Google row shows no subtitle. The two "Chưa liên kết" rows have no command to link them (no "Liên kết" button), so the status is a dead end.
Luật: `surfacecard-select-subtitle.md` (row title + subtitle, row titles are nouns), `table-heroui-native-section-head.md` (one content per card).
Grammar: `SurfaceCard` + `ListRow`, `Badge`, `Button size="sm"`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`.

## Dòng "Đây là địa chỉ bạn dùng để đăng nhập." dưới thẻ
Vì sao: SAI — a loose caption explaining the first row only; it belongs as that row's subtitle (already "nivo-owner@example.test") or nowhere.
Luật: `surfacecard-select-subtitle.md` (subtitle rule).
Grammar: `SurfaceCard note`.

## Đầu khối "Thiết bị đang đăng nhập 100"
Vì sao: SAI — the count "100" is plain text at the far right (1440) or under the label on its own line (390); the law says a 12px count chip beside the label on the left.
Luật: `table-heroui-native-section-head.md` (section head: label + count chip left).
Grammar: `PaneHeader title count`, `Badge`, `node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts`.

## Danh sách phiên (Chrome trên Windows, chip "Phiên hiện tại", nút "Đăng xuất")
Vì sao: SAI — a list card, each row = device icon tile, title, 12 muted "Đăng nhập 09-11 · Hoạt động vừa xong · IP ::ffff:127.0.0.1", and a neutral sm "Đăng xuất" at the right edge (correct). Defects: 100 identical rows with no paging and no "Đăng xuất tất cả" command; "Phiên hiện tại" is a red-dot pink chip, i.e. the alarm colour for the safe current session (pink is reserved for work waiting on the owner; this should be a neutral or success chip); the raw IPv6-mapped IP "::ffff:127.0.0.1" is a developer string, not user copy; on 390 the sign-out button shares the row with the chip and breaks into a second line.
Luật: `table-heroui-native-section-head.md` (pink only for waiting-on-owner; native table pagination), `type-scale-14-12.md`, `page-header-left-sublabel-xs.md` (sm buttons no icon).
Grammar: `SurfaceCard` + `ListRow`, `Badge tone`, `Pagination`, `Button size="sm"`, `node_modules/@starci/grammar/dist/core/composite/Pagination/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Badge/index.d.ts`.

## Hộp thoại xác nhận đăng xuất (không có trong shot)
Vì sao: CHƯA RÕ — `AlertDialog` for sign-out is in the code but never captured.
Luật: `verify-against-visualize.md`.
Grammar: `AlertDialog`, `node_modules/@starci/grammar/dist/core/frame/AlertDialog/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: SAI — nav row, blank strip, band, tabs; the cards stack; the count wraps under its label; the chip and button wrap.
Luật: `nivo-surface-layering.md`.
Grammar: `PaneGrid`.
