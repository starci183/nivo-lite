---
title: Second Brain / Kiến thức / Sự thật (Bản đồ)
route: /workspaces/<ws>/brain (tab Kiến thức, view Sự thật, mode Bản đồ)
area: brain-billing
---
# Second Brain, Sự thật, Bản đồ

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `BrainFacts` (components/blocks/BrainFacts/component.tsx) with frame `FactMapCard` (components/frames/FactMapCard) that draws Grammar `BubbleMap`. Shots `1440.png`, `390.png`, `390-bottom.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang và hai tầng tab
Vì sao: SAI — same chrome and tab layers as the sibling views, content at x 288 / 1408, but the same blank 64px strip above the band; header command is a neutral sm pill "Thêm sự thật" plus ⋯, correct per the sm-button law.
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md`, `suggestion-button-sm.md`.
Grammar: `PageHeader`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Công tắc "Danh sách / Bản đồ"
Vì sao: a 2-option mode switch drawn as a grey track with a white raised pill for the selected option: allowed as pill primary Tabs (2-4 mode switch), not a ButtonGroup. It sits top right of the card in the header zone.
Luật: `surfacecard-zones-api.md` (pill = primary tabs; no button group as tabs).
Grammar: `Tabs appearance="primary"`, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`; `SurfaceCard headers kind="toolbar"`.

## Tab theo agent (Toàn tiệm, Chatbot, Kế toán, Chatbot, Sales)
Vì sao: SAI — underline filter tabs in the card header zone (right pattern), but "Chatbot" appears twice, one of them is a duplicated tab key or a duplicate installation name; two identical tabs filter nothing distinguishable.
Luật: `surfacecard-zones-api.md`, `table-heroui-native-section-head.md` (tab counts: grey chip; here none are shown although other tab strips do).
Grammar: `Tabs`, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`.

## Bản đồ bong bóng (vòng ngoài, vòng trong, chấm đen giữa, nút +, −, khung)
Vì sao: SAI — the bubble map is a Grammar `BubbleMap` with zoom controls, but: the centre is a large solid black disc (not a theme token colour, the only black element in the app), the bubbles are orange (a colour that is not in the NIVO palette; owner colours are exact, so a hue that is not a token needs the owner's word), 73 facts become ~90 dots of unreadable size with no labels, and the empty right half of the card is not used. The map needs labels at least for the large bubbles and token colours.
Luật: `owner-colors-exact.md`, `grammar-core-heroui.md` (tokens only), dataviz rules.
Grammar: `BubbleMap`, `node_modules/@starci/grammar/dist/core/branch/BubbleMap/index.d.ts`; frame `FactMapCard` (`StatusDot`, `SurfaceCard`).

## Khung chi tiết bên phải ("Chọn một bóng")
Vì sao: SAI — a detail pane with a bold label and a 12-14px muted sentence ("Bấm vào một chủ đề hoặc một sự thật để xem giá trị, tài liệu và agent đọc nó."): an instruction as a lone sentence filling a pane. It should be an EmptyNotice (frameless) in the pane, the standard empty-selection pattern.
Luật: `table-heroui-native-section-head.md` (a lone sentence is never a card/description), ui-laws "EmptyNotice on a pane is frameless".
Grammar: `EmptyNotice frame="frameless"`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`; frame `DossierMapDetail`-style pane.

## Bố cục điện thoại 390
Vì sao: SAI — (partly right, see the flagged part) the map card stacks above the detail; nav row, blank strip and band as on the other views (SAI, same band defect).
Luật: `nivo-surface-layering.md`.
Grammar: `PaneGrid`.
