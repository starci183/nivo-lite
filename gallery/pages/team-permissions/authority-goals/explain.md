---
title: Giao quyền / Mục tiêu
route: /workspaces/<ws>/authority/goals
area: team-permissions
---
# Giao quyền, Mục tiêu

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Blocks `AuthorityGoals` (components/blocks/AuthorityGoals/component.tsx), `AuthoritySections` (left list), frame `AuthoritySection`. The folder `authority` holds the same default section; superseded by this folder. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console và dải đầu trang ("Giao quyền", mô tả)
Vì sao: SAI — white chrome and a band with breadcrumb, title and 14 muted sublabel flush left and NO tabs and no commands (right: the sections are a left list pane); defect: blank 64px pink strip above the band. The sidebar entry "Giao quyền" is current; "Quyền" (a different page) sits in the same group (naming overlap).
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md`.
Grammar: `PageHeader`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Cột trái: danh sách mục (Mục tiêu, Chính sách, Phạm vi tự động, Giới hạn, Nhân viên (tùy chọn))
Vì sao: a Layout B nav pane: rows = noun title 14/500 + 12 muted subtitle, the selected row with a grey fill; it behaves like tabs (one section per page view) and is built with a `ListBox`. A vertical list of sections is acceptable as a master list; on 390 it becomes the whole page and the form is on another screen.
Luật: `surfacecard-select-subtitle.md` (row title noun + subtitle), `pink-page-surface-rule.md`.
Grammar: `ListBox`, `node_modules/@starci/grammar/dist/core/branch/ListBox/index.d.ts`; block `AuthoritySections`.

## Thẻ biểu mẫu mục tiêu (Mục tiêu doanh thu, khách hàng mới, phản hồi đầu tiên, ghi chú)
Vì sao: SAI/OK split. OK: one input group (a form) in one card with its own footer "Lưu" at the right; labels 14/500, hints 12 muted under their own fields. SAI: the three numeric fields are `NumberField` with − / + steppers, which for VND revenue (e.g. 50.000.000) makes the steppers meaningless and the empty fields look like zero; the grid is uneven (two columns then one) leaving a hole beside "Phản hồi đầu tiên trong (phút)"; the footer button "Lưu" is a sm-sized pill with no state (disabled until a change).
Luật: `table-heroui-native-section-head.md` (form footer Huỷ/Lưu in the card; one content per card), `surfacecard-select-subtitle.md` (flat fields), `type-scale-14-12.md`.
Grammar: `NumberField`, `Textarea`, `Grid`, `SurfaceCard footers`, `node_modules/@starci/grammar/dist/core/leaf/NumberField/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/Textarea/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Dòng "Doanh thu, khách hàng và tốc độ phản hồi. Tổng quan sẽ đo kết quả thật so với các mục tiêu này." dưới thẻ
Vì sao: SAI — a loose explanatory caption under the card (it repeats the left list subtitle and explains behaviour); captions under a card are only data legends.
Luật: `surfacecard-select-subtitle.md` (subtitle rule), `table-heroui-native-section-head.md`.
Grammar: `SurfaceCard note`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: SAI — (partly right, see the flagged part) the sections list is the whole screen (master list), each row opens its form; nav row, blank strip and band as everywhere (SAI, blank strip).
Luật: `nivo-surface-layering.md`.
Grammar: `ListBox`, `PaneGrid`.
