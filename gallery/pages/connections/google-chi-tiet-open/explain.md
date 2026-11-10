---
title: Chi tiết Google Sheets (đang chạy)
route: /workspaces/<ws>/connections/open/<id>
area: connections
---
# Chi tiết kết nối Google (Sheets)

Generic "open" detail (`ConnectionOpenHead`, `ConnectionOpenContent`, `ConnectionOpenEvents`, `ConnectionOpenFacts`). Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console (thanh trên, thanh bên)
Vì sao: white console chrome, "Kết nối" current in the sidebar; theme toggle has no law behind it (CHƯA RÕ).
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`.

## Dải đầu trang (đường dẫn 3 cấp "Kết nối / Google (Sheets) / Google - cuongnvtse160875@gmail.com", logo Google, tên "Google - cuongnvtse160875@gmail.com", chip "Đang chạy", e-mail lặp lại, nút "Sổ cái trên Google Sheets", ⋯, tab Tổng quan / Sự kiện / Agent / Cài đặt)
Vì sao: SAI — the title is "Google - cuongnvtse160875@gmail.com" (provider and e-mail glued with a hyphen) and the sub-line repeats the same e-mail, and the last breadcrumb repeats it a third time; the one command is a neutral pill that opens the ledger spreadsheet (an external link without the ↗ glyph). The tabs are the generic four.
Luật: `page-header-left-sublabel-xs.md`, `table-heroui-native-section-head.md` (tab counts grey; raw ids in a collapsed list).
Grammar: `PageHeader tabs`, `Button`, `DropdownMenu`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Khối "Thông tin kết nối" (Loại kết nối, Tên, Chi tiết)
Vì sao: SAI — three rows: "Google (Sheets)", "Google - e-mail" and the e-mail again; the same e-mail appears five times on the screen and no fact is new (no sheet name, no last sync, no permission).
Luật: `table-heroui-native-section-head.md`.
Grammar: `DescriptionList`, `node_modules/@starci/grammar/dist/core/composite/DescriptionList/index.d.ts`.

## Cột phải "Sự kiện" + "Trực tiếp" (Chưa có sự kiện)
Vì sao: SAI — empty state as a floating card (icon, bold line, sentence) instead of a frameless notice in a pane.
Luật: ui-laws "EmptyNotice on a pane is frameless".
Grammar: `EmptyNotice frame="frameless"`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.
