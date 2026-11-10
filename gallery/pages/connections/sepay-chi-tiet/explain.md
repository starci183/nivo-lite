---
title: Kết nối / SePay / chi tiết
route: /workspaces/<ws>/connections/sepay/<id>
area: connections
---
# Chi tiết kết nối SePay

Blocks `SepayConnectionHead`, `SepayConnectionSteps`, `SepayHealth`, `SepayNotices`, `SepayRail`. Shots `1440.png`, `390.png`; folder `connection-sepay-grants` is a twin capture of the same page, superseded by this folder. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console (thanh trên, thanh bên)
Vì sao: white console chrome, "Kết nối" current in the sidebar; theme toggle has no law behind it (CHƯA RÕ).
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`.

## Dải đầu trang (đường dẫn 3 cấp, logo, "SePay", chip "Đang chạy", dòng "SePay · •••• 9999", ⋯, tab Tổng quan / Sự kiện / Agent 2 / Cài đặt)
Vì sao: flush-left breadcrumb, brand tile, title with a success chip, sub-line with the masked account and tabs, with only a ⋯ menu as command (no primary because the connection is running); correct. The breadcrumb "Nguồn tiền về (SePay) / SePay" repeats the name twice.
Luật: `page-header-left-sublabel-xs.md`, `table-heroui-native-section-head.md` (tab counts grey; raw ids in a collapsed list).
Grammar: `PageHeader tabs`, `Button`, `DropdownMenu`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Khối "Thông tin kết nối" (Ngân hàng, Tài khoản, Chủ tài khoản, Môi trường, URL nhận webhook, API Key, Webhook gần nhất, Xác thực hợp lệ, Đã chặn trùng lặp)
Vì sao: SAI — a nine-row details card; the useful facts (bank, account, owner, environment) are mixed with technical items: a 90-character webhook URL wrapped over two lines (`https://nivo-local.starci.org/api/connections/sepay/44c471c0-...`), a masked API key, counters "0/0" and "0" with no unit; the law moves raw ids and keys to a collapsed "Chi tiết kỹ thuật" list card and keeps the facts card to what the owner needs; the webhook URL needs the copy field (`ConnectionCopyInput`), not text.
Luật: `table-heroui-native-section-head.md` (raw ids in "Chi tiết kỹ thuật"), `type-scale-14-12.md`.
Grammar: `DescriptionList`, `CopyField`, `Disclosure`, `node_modules/@starci/grammar/dist/core/composite/DescriptionList/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/CopyField/index.d.ts`.

## Cột phải: thẻ "Chưa có sự kiện nào. Khi SePay gửi webhook, chúng hiện ở đây."
Vì sao: SAI — an empty state in a floating white card with no label above it (the other detail pages label this column "Kiểm tra từng phần" or "Sự kiện"); a lone sentence in a card; an empty state on a pane is frameless.
Luật: `table-heroui-native-section-head.md` (a lone sentence is never a card), ui-laws "EmptyNotice on a pane is frameless".
Grammar: `EmptyNotice frame="frameless"`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Khối "Agent dùng kết nối này" (Kế toán "Tự làm trong giới hạn ▾", Sales "Chỉ đọc ▾")
Vì sao: SAI — (partly right, see the flagged part) the head is label + a grey count chip "2" at the far RIGHT (SAI, the chip belongs next to the label); the card is one list: avatar with a gear badge, name and a grey Select-style button for the permission level, no assign control in this state. Correct list anatomy.
Luật: `table-heroui-native-section-head.md`.
Grammar: `SurfaceCard` + `ListRow`, `Select`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`.
