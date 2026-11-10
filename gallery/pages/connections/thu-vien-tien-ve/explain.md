---
title: Kết nối / Thư viện / Tiền về
route: /workspaces/<ws>/connections (tab Thư viện, nhóm Tiền về)
area: connections
---
# Thư viện, nhóm Tiền về

Same block as `thu-vien` filtered to the Tiền về category; superseded by `thu-vien` for the shared regions (band, tabs, search, group head, cards). Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Tầng tab 2 với "Tiền về 5" đang chọn
Vì sao: the selected category is the primary red underline with a grey chip; the filter changes only the group list.
Luật: `page-header-left-sublabel-xs.md`, `table-heroui-native-section-head.md`.
Grammar: `PageHeader subTabs`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Thẻ nhà cung cấp tiền về (SePay, payOS, Casso, VNPAY, MoMo)
Vì sao: SAI — same card defects as `thu-vien` (uneven heights, orphan MoMo card on the second row; "Chưa nối" chips; the "Thêm tài khoản", "Tiếp tục", "Kết nối" pill labels differ per provider although all start the same wizard).
Luật: `table-heroui-native-section-head.md`, `suggestion-button-sm.md`.
Grammar: `Grid kind="cards"`, `SurfaceCard`, `node_modules/@starci/grammar/dist/core/frame/Grid/index.d.ts`.

## Khối "Công cụ agent dùng được" (SePay)
Vì sao: SAI — a card in a card with lowercase chips "đang hoạt động" and "có sẵn" and the status text "chưa duyệt · chưa kiểm tra" (developer wording); see `thu-vien/explain.md`.
Luật: `table-heroui-native-section-head.md`.
Grammar: `SurfaceCard`, `DisclosureList`, `node_modules/@starci/grammar/dist/core/composite/DisclosureList/index.d.ts`.
