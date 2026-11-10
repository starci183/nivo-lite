---
title: Second Brain / Kiến thức / Hồ sơ
route: /workspaces/<ws>/brain (tab Kiến thức, view Hồ sơ)
area: brain-billing
---
# Second Brain, Kiến thức, Hồ sơ (trống)

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `BrainDossiers` (components/blocks/BrainDossiers/component.tsx) on `PaneGrid`. The shot is the EMPTY state; the dossier list, the map and the finding drawers are not shown. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang và hai tầng tab
Vì sao: SAI — same chrome as the sibling views (white top bar, sidebar, band with breadcrumb/title/sublabel, tab layers one and two), but the band's content is shifted 20px left (text starts at x 268, the actions end at x 1428) compared with the other Brain views (x 288, x 1408): the main pane is full-bleed here and 80rem-centred elsewhere; and the same blank 64px strip above the band.
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md`, `table-heroui-native-section-head.md` (80rem cap only for card panes).
Grammar: `PaneGrid`, `PageHeader`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Nút "Nhập danh mục hồ sơ" và ⋯ (đầu trang)
Vì sao: SAI — the same command appears twice on the screen (neutral sm pill in the band and a primary md button in the empty notice), as on the Lessons tab; one command, one place.
Luật: `suggestion-button-sm.md`, `page-header-left-sublabel-xs.md` (sm buttons no icon).
Grammar: `Button size="sm"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.

## Trạng thái trống ("Chưa có hồ sơ nào" + mô tả + nút)
Vì sao: SAI — (partly right, see the flagged part) frameless EmptyNotice centred in the pane: icon tile, one bold message, one sentence and a primary commit. The description is one 130-character line stretched across 880px: SAI — it should wrap at a reading measure (about 60ch).
Luật: ui-laws "EmptyNotice on a pane is frameless", `type-scale-14-12.md`.
Grammar: `EmptyNotice frame="frameless"`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Danh sách hồ sơ và bản đồ hồ sơ (không có trong shot)
Vì sao: CHƯA RÕ — the loaded dossier list/map (`DossierList`, `DossierMapPane`) has no shot here.
Luật: `verify-against-visualize.md`.
Grammar: `PaneGrid`, `BubbleMap`, `node_modules/@starci/grammar/dist/core/branch/BubbleMap/index.d.ts`.
