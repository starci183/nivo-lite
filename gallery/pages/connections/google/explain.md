---
title: Kết nối / Google (tài khoản)
route: /workspaces/<ws>/connections/google
area: connections
---
# Google, trang tài khoản (tab Dịch vụ)

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Blocks `GoogleWizard` (setup), composites `GoogleServicesCard`, `ConnectionSetupCard`, frames `ConnectionBand`, `ConnectionSavedFacts`; the page reads the Google account's services. Folder `drive` is the same page (Drive is one service of this account); superseded by this folder. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console (thanh trên, thanh bên)
Vì sao: white console chrome; "Kết nối" current. Theme toggle has no law behind it (CHƯA RÕ).
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`.

## Dải đầu trang (đường dẫn 3 cấp, logo Google, email, chip "Đang thiết lập 2/4", tab Dịch vụ / Sự kiện / Agent / Cài đặt)
Vì sao: SAI/OK split. OK: flush-left breadcrumb, brand tile, title and a 12 muted line, tab layer one under it. SAI: the title is the raw email address "cuongnvtse160875@gmail.com" at heading size (a personal identifier as the page title where the provider name "Google" belongs), with the status chip glued to its right; the page has no command in the band although setup is unfinished (the telegram/zalo pages have "Tiếp tục thiết lập" there).
Luật: `page-header-left-sublabel-xs.md`, `nivo-surface-layering.md`, `table-heroui-native-section-head.md` (tab counts).
Grammar: `PageHeader tabs`, `Badge`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Khối "Thiết lập · bước 2/4" (Stepper + câu "Cần cấp quyền Google Drive")
Vì sao: SAI — a block label then ONE card that holds two contents: a horizontal Stepper (Thông tin ✓, Cấp quyền 2, Kiểm tra, Giao agent) and, under a divider, a title + sentence "Cần cấp quyền Google Drive / NIVO chỉ đọc, không sửa hay xoá gì trong Drive của bạn, và bạn có thể ngắt kết nối bất cứ lúc nào." The law is one content per card; the sentence has no command next to it (the Telegram page's twin card has the primary "Tiếp tục thiết lập" button), so the user does not know the next click.
Luật: `table-heroui-native-section-head.md` (ONE CONTENT PER CARD; a lone sentence is never a card), `surfacecard-select-subtitle.md`.
Grammar: `Stepper`, `SurfaceCard`, `Button endArrow`, `node_modules/@starci/grammar/dist/core/composite/Stepper/index.d.ts`; composite `ConnectionSetupCard`.

## Đầu khối "Dịch vụ của tài khoản này" kèm câu "Bật dịch vụ nào, Google xin thêm đúng quyền đó"
Vì sao: SAI — a description sits BESIDE the label as a grey chip-like caption (1440) or inline text (the second shot); the law says a section head holds the label (+ count chip) on the left and ONE link or ⓘ on the right, and no description; the sentence should be the row subtitle or an ⓘ.
Luật: `table-heroui-native-section-head.md` (section head: no description under or beside the label).
Grammar: `PaneHeader title`, `node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts`.

## Danh sách dịch vụ (Google Drive "Bật", Google Sheets "Đang bật" + "Chọn bảng", Google Calendar "Sắp có", Gmail "Sắp có")
Vì sao: SAI — (partly right, see the flagged part) one list card of services: brand icon, noun title, 12 muted subtitle ("Chỉ đọc · nạp tài liệu vào Second Brain"), and at the right a neutral sm button or chip: "Bật", status chip + "Chọn bảng", or a "Sắp có" chip. Same-kind items are in one list (correct). SAI: the right side mixes three kinds of control (a button, a chip + button, a chip), and "Sắp có" is shown as an outlined chip that looks like a button.
Luật: `surfacecard-select-subtitle.md` (row title + subtitle), `suggestion-button-sm.md`, `table-heroui-native-section-head.md`.
Grammar: `SurfaceCard` + `ListRow`, `Button size="sm"`, `Badge`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`; composite `GoogleServicesCard`.

## Khối "Thông tin kết nối" (Quyền đã cấp, Tài khoản Google, Tài liệu đã nạp)
Vì sao: SAI — (partly right, see the flagged part) a label and a details card of facts (two columns, hairline separators). It repeats the e-mail already in the title; "Quyền đã cấp: Sheets đọc và ghi" contradicts the card above ("Cần cấp quyền Google Drive").
Luật: `table-heroui-native-section-head.md` (raw ids in "Chi tiết kỹ thuật" list card, collapsed).
Grammar: `DescriptionList`, `SurfaceCard kind="details"`, `node_modules/@starci/grammar/dist/core/composite/DescriptionList/index.d.ts`.

## Cột phải "Tiến độ nạp" (thẻ trống, nút "Bật Google Drive")
Vì sao: SAI — a block label and a floating card with an icon tile, bold message ("Chưa có tài liệu nào đến từ Google Drive."), a two-line sentence and a primary pill: an empty state as a card on the pink; the aside law says the aside is a full-height white pane with a left border (below lg the first block); an empty state on a pane is frameless. The primary "Bật Google Drive" duplicates the "Bật" button of the Drive row.
Luật: `nivo-surface-layering.md` (aside = white pane, left border), `pink-page-surface-rule.md`, ui-laws "EmptyNotice on a pane is frameless".
Grammar: `Pane area="aside" surface`, `EmptyNotice frame="frameless"`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: CHƯA RÕ — see `390.png`; the page stacks into one column, the aside block should become the first block (not verified); the nav row and blank strip of the other 390 shots apply.
Luật: `verify-against-visualize.md`, `nivo-surface-layering.md`.
Grammar: `PaneGrid`.
