---
title: Kết nối / payOS / chi tiết (đang thiết lập)
route: /workspaces/<ws>/connections/open/<id>
area: connections
---
# Chi tiết payOS (kết nối đang thiết lập)

The folder `connection-payos-grants` is a twin capture of the same page, superseded by this folder. Block `ConnectionOpenHead` + `ConnectionOpenContent`/`ConnectionOpenEvents` (the generic "open" detail used by providers without their own detail blocks). Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console (thanh trên, thanh bên)
Vì sao: white console chrome, "Kết nối" current in the sidebar; theme toggle has no law behind it (CHƯA RÕ).
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`.

## Dải đầu trang (đường dẫn 3 cấp, logo payOS, tên "payOS", chip "Đang thiết lập 2/4", nút "Tiếp tục", ⋯, tab Tổng quan / Sự kiện / Agent / Cài đặt)
Vì sao: SAI/OK split. OK: flush-left breadcrumb, brand tile, title, status chip and tabs; "Tiếp tục" and ⋯ at the right. SAI: the band is 8px shorter than the other detail pages (no sub-line), so tabs sit at a different y on payOS than on Zalo/Telegram/SePay; "Tiếp tục" is neutral here while Telegram uses a primary "Tiếp tục thiết lập →" for the identical state.
Luật: `page-header-left-sublabel-xs.md`, `table-heroui-native-section-head.md` (tab counts grey; raw ids in a collapsed list).
Grammar: `PageHeader tabs`, `Button`, `DropdownMenu`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Nút "Giao cho agent" nổi trên nền hồng
Vì sao: SAI — a neutral pill floats at the top of the left column with no head and no card; it is the assignment command of the "Agent dùng kết nối này" block that does not exist here, so a control appears without a block; should live in that block's head or card header zone.
Luật: `table-heroui-native-section-head.md` (section head), `pink-page-surface-rule.md` (a block's own controls live in its header).
Grammar: `Select`, `Button size="sm"`, `node_modules/@starci/grammar/dist/core/branch/Select/index.d.ts`.

## Khối "Thông tin kết nối" (Loại kết nối, Tên)
Vì sao: SAI — a details card with only two rows ("Loại kết nối: Thanh toán qua payOS", "Tên: payOS") where the name repeats the title and the type repeats the breadcrumb: no information; the SePay detail shows nine rows.
Luật: `table-heroui-native-section-head.md`.
Grammar: `DescriptionList`, `node_modules/@starci/grammar/dist/core/composite/DescriptionList/index.d.ts`.

## Cột phải "Sự kiện" + chip "Trực tiếp" (Chưa có sự kiện, "Sự kiện đầu tiên sẽ hiện ở đây.")
Vì sao: SAI — label with a live chip at the right and a floating card holding only an icon, a bold line and a sentence: an empty state in a card (should be frameless in the pane); the SePay detail has the same state without a label.
Luật: ui-laws "EmptyNotice on a pane is frameless", `table-heroui-native-section-head.md`.
Grammar: `EmptyNotice frame="frameless"`, `Badge`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.
