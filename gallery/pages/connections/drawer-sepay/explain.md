---
title: Ngăn kéo thư viện / Nguồn tiền về (SePay)
route: /workspaces/<ws>/connections (Thư viện, mở thẻ Nguồn tiền về (SePay))
area: connections
---
# Ngăn kéo chi tiết nhà cung cấp: Nguồn tiền về (SePay)

A right-hand `Drawer` over the library (component `ConnectionOpenContent` / `ConnectionLibraryTile` detail). Shots `1440.png`, `390.png`; the older drawer iterations are in `connector-drawer-1..6` (before only), superseded by this folder and its siblings. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Nền mờ và nút đóng (×)
Vì sao: a modal drawer dims the page and has one round close button top right; the focus stays inside it.
Luật: `grammar-core-heroui.md`.
Grammar: `Drawer`, `IconButton`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/IconButton/index.d.ts`.

## Đầu ngăn kéo (tên "Nguồn tiền về (SePay)", biểu tượng, "Thanh toán và ngân hàng", chip "Chính thức", mô tả)
Vì sao: SAI — the drawer title "Nguồn tiền về (SePay)" is 14-size plain text at the top left, then a second heading-like line "Thanh toán và ngân hàng" with its own chip "Chính thức" and a description: a title, a sub-title, a chip and a sentence stacked with no clear hierarchy; the chip is at the far right edge and is clipped by the drawer padding.
Luật: `type-scale-14-12.md`, `page-header-left-sublabel-xs.md`.
Grammar: `Drawer title`, `IdentityLockup`, `Badge`, `node_modules/@starci/grammar/dist/core/composite/IdentityLockup/index.d.ts`.

## Danh sách "Mang về / Dành cho / Cần chuẩn bị"
Vì sao: SAI — a list card of three rows (noun title 14/500 + 12 muted value) is the right pattern (the earlier iterations used bold run-in labels), but the "Cần chuẩn bị" value, the most important text (what the owner must have before starting), is TRUNCATED with an ellipsis, so the prerequisite cannot be read without opening the wizard.
Luật: `surfacecard-select-subtitle.md` (row title noun + subtitle), `table-heroui-native-section-head.md` (one content per card).
Grammar: `SurfaceCard` + `ListRow`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`.

## Khối "Kết nối của bạn" (số lượng, thẻ kết nối)
Vì sao: SAI/OK split. OK: label + grey count chip on the left, as the head law says. The body is a card "SePay" with "Mở trang →", "Agent (2)" and ⋯, the chip "Đã kết nối" and "MBBANK · •••• 9999 · CONG TY TNHH CONG NGHE NIVO · Đang dùng bởi: Kế toán, Sales"; that card packs four controls in a row (a neutral pill, a red link, a count pill, ⋯) with mixed shapes, and raw ids in the subtitle which belong in "Chi tiết kỹ thuật".
Luật: `table-heroui-native-section-head.md` (raw ids; section head label + count chip), `suggestion-button-sm.md` (one pill pattern), `page-header-left-sublabel-xs.md` (sm buttons no icon: "Mở trang →" has an arrow).
Grammar: `SurfaceCard`, `Button size="sm"`, `DropdownMenu`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`; composite `ConnectionRowBody`.

## Nút chính ở cuối
Vì sao: the primary "+ Thêm kết nối" at the end of the drawer body, left aligned and not sticky; commands of a drawer belong in the footer zone (`DrawerFooter`), not floating under the content, so the user must scroll to find it on a long list.
Luật: `surfacecard-zones-api.md` (footers), `owner-colors-exact.md`.
Grammar: `DrawerFooter` composite, `Drawer footer`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: CHƯA RÕ — the phone drawer is in `390.png` but judged only for the shared defects above.
Luật: `verify-against-visualize.md`.
Grammar: `Drawer`.
