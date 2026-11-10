---
title: Second Brain / Kiến thức / Tài liệu
route: /workspaces/<ws>/brain (tab Kiến thức, view Tài liệu)
area: brain-billing
---
# Second Brain, Kiến thức, Tài liệu

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `BrainDocuments` (components/blocks/BrainDocuments/component.tsx) in frame `BrainPanes`. Shots `1440.png`, `390.png`, `390-bottom.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Overlays ("N", red dot) are not content.

## Khung console (thanh trên, thanh bên)
Vì sao: same white console chrome as every Brain page; "Second Brain" current with the pink 73 chip.
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`, `table-heroui-native-section-head.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`.

## Dải đầu trang và tầng tab 1 (Việc cần làm 73, Kiến thức, Công khai, Hỏi thử)
Vì sao: SAI — flush left breadcrumb, title and sublabel, the page tabs in the band; but the blank 64px pink strip above the band and no header command on this view (the "Thêm tài liệu" action of the sibling views is missing here while the empty views have it), so the owner cannot add a document from the list.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`, `page-header-left-sublabel-xs.md`.
Grammar: `Page header tabs`, `PageHeader`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`; composite `BrainHeaderActions`.

## Tầng tab 2 (Sự thật 73, Tài liệu 7, Hồ sơ, Bài học)
Vì sao: the second tab layer lives in the white band under layer 1, same 14/40/500, underline on a full-width separator, flush left, grey count chips for plain quantities; exactly the law. "Hồ sơ" and "Bài học" show no count because 0 hides on page tabs.
Luật: `page-header-left-sublabel-xs.md` (second tab layer in the white band), `table-heroui-native-section-head.md` (page tabs hide 0, chips grey), `surfacecard-zones-api.md`.
Grammar: `PageHeader subTabs`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`; composite `brainHeaderSubTabs`.

## Danh sách tài liệu (tên + loại, "N chờ duyệt", "Chờ duyệt", ngày)
Vì sao: SAI — the block defines a `SurfaceCard kind="table"` with four columns but the shot has no header row and no grey native frame: it reads as a hand-rolled list with columns. Each row repeats the same news twice ("11 chờ duyệt" chip and a "Chờ duyệt" status chip), every type reads "Văn bản", and the date has no column label. Should be the native table (grey frame, header labels Tên, Sự thật, Trạng thái, Cập nhật, pagination footer) with one status chip and the type as a muted line only when it differs.
Luật: `table-heroui-native-section-head.md` (any columned data is a Table; native frame; column API), `type-scale-14-12.md`.
Grammar: `SurfaceCard kind="table" columns rows`, `DataTable`, `node_modules/@starci/grammar/dist/core/branch/DataTable/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Ngăn kéo chi tiết tài liệu (khi chọn một dòng, không có trong shot)
Vì sao: CHƯA RÕ — a row opens a drawer with facts of the document (`factRowsOf`), but no screenshot shows it.
Luật: `verify-against-visualize.md`.
Grammar: `Drawer`, `ListRow`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: SAI — nav row, blank strip, band, scrolling tab strips; the table becomes a list of rows per the law ("phone = list of rows"), the same data repeated twice per row.
Luật: `table-heroui-native-section-head.md`.
Grammar: `DataTable` responsive.
