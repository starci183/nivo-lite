---
title: Second Brain / Việc cần làm
route: /workspaces/<ws>/brain
area: brain-billing
---
# Second Brain, tab "Việc cần làm"

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `BrainTodo` (components/blocks/BrainTodo/component.tsx) in frame `BrainPanes` (components/frames/BrainPanes) with composites `BrainInboxRail`, `BrainHeaderActions`. Shots `1440.png`, `390.png`, `1440-bottom.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. The Next "N" and the red assistant dot are overlays, not content.

## Khung console (thanh trên, thanh bên)
Vì sao: white top bar (workspace identity, round language dropdown, theme toggle, Sprout avatar) and white sidebar with the current item "Second Brain" as a pink pill with a pink 73 chip (work waiting on the owner). The theme toggle has no owner law behind it (dark must come from tokens only): CHƯA RÕ whether a visible toggle is wanted.
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`, `table-heroui-native-section-head.md` (pink chip = waiting on owner), `owner-colors-exact.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`.

## Dải đầu trang (đường dẫn, "Second Brain", mô tả, nút "Thêm tài liệu", nút ⋯)
Vì sao: SAI — flush-left breadcrumb, title and 14 muted sublabel are right, and the two commands (one neutral sm pill, one ⋯ menu) at the far right are right; but a blank 64px pink strip sits above the band at 1440 and, on 390, under the nav row; the sticky band then overlays scrolled cards (the first card "Chậu hoa · giá" is clipped at the top). The band must sit directly under the top bar.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md` (header band never scrolls away), `page-header-left-sublabel-xs.md` (sm buttons no icon).
Grammar: `Page header`, `PageHeader`, `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`; composite `BrainHeaderActions` (`Button size="sm"`, `DropdownMenu`).

## Tầng tab 1 (Việc cần làm 73, Kiến thức, Công khai, Hỏi thử)
Vì sao: layer-1 page tabs inside the white band, 14/40/500, selected = primary red with underline on a full-width separator, count as a 12px pink chip because 73 is work waiting on the owner; flush left. On 390 the tab strip scrolls horizontally with a chevron and clips "Hỏi thử".
Luật: `surfacecard-zones-api.md` (underline = secondary tabs flush on the edge), `table-heroui-native-section-head.md` (tab counts: pink only for owner-waiting), `page-header-left-sublabel-xs.md`.
Grammar: `Page header tabs={{ items, selectedKey }}`, `Tabs`, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`; `Badge`.

## Thẻ xung đột "Chậu hoa · giá" (biểu tượng cảnh báo, chip "Sản phẩm", nút "So sánh") và dòng chú thích
Vì sao: SAI — the card is one conflict item (a row with icon tile, title, 12 muted value text, a category chip and a neutral sm "So sánh" button) and is correct as a list card; but it appears with no section head, so nothing says it is "Xung đột cần quyết"; and the 12px line beneath ("Xem từng cái một: agent chưa dùng mục nào cho tới khi bạn chọn") is an explanation that must be a subtitle of the head or the row, not a floating caption.
Luật: `table-heroui-native-section-head.md` (section head label + count; descriptions become captions only for data legends), `surfacecard-select-subtitle.md`.
Grammar: `Section`, `PaneHeader`, `SurfaceCard` + `ListRow`, `node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`.

## Đầu khối "Sự thật mới 72"
Vì sao: SAI — label left and the count "72" in a grey chip at the far RIGHT; the law puts the count chip next to the label on the left and reserves the right side for one → link; on 390 it wraps below the label.
Luật: `table-heroui-native-section-head.md` (section head: label + count chip left, one → link right).
Grammar: `PaneHeader title count`, `Badge`, `node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts`.

## Bảng duyệt sự thật: tab lọc (Mọi mức tin cậy 72, Chỉ tin cậy cao 72)
Vì sao: underline filter tabs in the card's header zone with grey count chips, which is the filter zone of a list card; the counts are plain quantities (grey).
Luật: `surfacecard-zones-api.md` (headers filter/toolbar), `table-heroui-native-section-head.md` (filter tabs show grey 0).
Grammar: `SurfaceCard headers=[{ kind: "filter" }]`, `Tabs`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Dòng hướng dẫn "Chọn cả tài liệu, cả nhóm hay từng dòng để duyệt một lần." và công tắc "Theo tài liệu / Theo chủ đề"
Vì sao: SAI on the sentence: a loose explanatory line inside the card header zone, on 390 it takes four lines and pushes the view switch aside; it should be a hint under the control or dropped. The "Theo tài liệu / Theo chủ đề" 2-option switch is a pill primary Tabs (view switch), allowed.
Luật: `surfacecard-select-subtitle.md` (subtitle rule), `surfacecard-zones-api.md` (pill = primary tabs for 2-4 mode switch).
Grammar: `Tabs appearance="primary"`, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`; `SurfaceCard headers kind="toolbar"`.

## Bảng sự thật (cột Mục, Giá trị, Tin cậy, Mở; ô chọn, dòng nhóm, chip, mũi tên)
Vì sao: SAI — columned data drawn as a table inside the card but with the HeroUI header labels only partially (Mục / Giá trị / Tin cậy / Mở) and rows of mixed shapes: a group row ("Sản phẩm và bảng giá", "20 chờ duyệt", button "Thu gọn") then child rows with a checkbox, a 2-line 12px muted subtitle ("Sản phẩm và bảng giá, Mẫu hoa đang bán (giá thử)") repeated identically on every row, a value, a "Tin cậy cao" chip and a → arrow. The repeated subtitle is the parent group name and adds nothing; the table does not use the grey frame with the pagination footer ("1–10 trong 72"), and 72 rows have no paging.
Luật: `table-heroui-native-section-head.md` (native table: grey frame, white body, grey pagination footer; column API; phone = list of rows), `type-scale-14-12.md`.
Grammar: `SurfaceCard kind="table" columns rows`, `DataTable`, `Pagination`, `node_modules/@starci/grammar/dist/core/branch/DataTable/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/Pagination/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Cột phải: "Agent đang dùng 0 / 73 sự thật" và dòng chú thích
Vì sao: SAI — aside card with a progress meter (0 of 73 facts in use) is a good figure; the caption under it ("Sự thật chỉ được dùng sau khi bạn duyệt. Duyệt theo tài liệu là nhanh nhất...") is a loose explanatory paragraph (12px, three lines) that should be the card's subtitle; and the aside is drawn as a floating card on the pink instead of a full-height white aside pane with a left border (the aside law).
Luật: `nivo-surface-layering.md` (white full-height aside with left border; below lg it becomes the first block), `pink-page-surface-rule.md` (aside items are sections, not floating cards), `surfacecard-select-subtitle.md`.
Grammar: `Pane area="aside" surface`, `Progress`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Progress/index.d.ts`; composite `BrainInboxRail`.

## Bố cục điện thoại 390
Vì sao: SAI — nav row (⋯), blank strip, breadcrumb/title/sublabel, two buttons on their own row, tabs scrolling horizontally; the aside block moves into the well after the main list per the law, but the first card is overlapped by a stray "1" fragment of the tab strip (clipping defect).
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md`.
Grammar: `PaneGrid`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`.
