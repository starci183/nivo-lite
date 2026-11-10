---
title: Second Brain / Tài liệu / Tri thức NIVO nền
route: /workspaces/<ws>/knowledge/nivo
area: brain-billing
---
# Tri thức NIVO nền

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Blocks `KnowledgeDocs` (components/blocks/KnowledgeDocs/component.tsx) with frames `KnowledgeDocList`, `KnowledgeAddDrawer`, composite `BrainInboxRail` (the suggestions rail). Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang (4 cấp đường dẫn) và hai tầng tab
Vì sao: SAI — the breadcrumb is Tổng quan / Second Brain / Tài liệu / Tri thức NIVO nền (right), title "Second Brain", sublabel, tab layers one and two with Kiến thức and Tài liệu selected (right). Defects: the blank 64px strip above the band, and the primary action here is a RED md button with an upload icon "Thêm tài liệu" while the same command is a neutral sm pill without icon on `brain-todo`: one command, two forms.
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md` (sm buttons no icon), `suggestion-button-sm.md`.
Grammar: `PageHeader`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`; composite `BrainHeaderActions`.

## Cột trái: tab "Tất cả 7 / NIVO nền 0 / Thêm ▾", chọn "Mọi agent", danh sách trống
Vì sao: a Layout B list pane with its own tabs and a Select filter and an EmptyNotice ("Tri thức NIVO nền chưa được nạp." with a how-to sentence): the pane head with filter tabs and the empty list is the right pattern; the "Thêm ▾" overflow of tabs is the zones rule ("extra tabs fold into More").
Luật: `surfacecard-zones-api.md` (extra tabs fold into More), `pink-page-surface-rule.md` (list pane head), ui-laws "EmptyNotice on a pane is frameless".
Grammar: `Tabs`, `Select`, `EmptyNotice`, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`; frame `KnowledgeDocList`.

## Cột giữa: thẻ "Tri thức NIVO nền chưa được nạp."
Vì sao: SAI — the exact same message already shows in the left pane's empty state, and here it is repeated inside a white floating card with only an icon and one sentence (a lone sentence is never a card); the middle pane should be the document reader's empty selection ("Chọn một tài liệu") or be absent.
Luật: `table-heroui-native-section-head.md` (a lone sentence is never a card), `pink-page-surface-rule.md`.
Grammar: `EmptyNotice frame="frameless"`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`; composite `KnowledgeDocBody`.

## Cột phải: "Duyệt 73 sự thật để agent bắt đầu dùng ↗" và "Nên bổ sung" (5 gợi ý với nút "Thêm" và ⋯)
Vì sao: SAI/OK split. OK: the aside is a white full-height pane with a left border, the rows are noun titles with 12 muted truncated descriptions and a neutral sm "Thêm" pill plus ⋯, hairline separated, within one list card; "Xem thêm 6 gợi ý" is a neutral sm pill (suggestion pattern). SAI: the red link at the top is a navigation link with the inline ↗ glyph where a section-head "→" is the rule (the target is in-app), the list card sits inside a pane that is already white (card in white pane has a border, as the law says, but the card shadow is visible), titles wrap to two lines while descriptions truncate.
Luật: `nivo-surface-layering.md` (white aside with left border), `table-heroui-native-section-head.md` (links: head "→", inline "↗"), `suggestion-button-sm.md`.
Grammar: `Pane area="aside" surface`, `SurfaceCard` + `ListRow`, `Button size="sm"`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`; composite `BrainInboxRail`.

## Dòng chú thích dưới danh sách gợi ý
Vì sao: SAI — a three-line 12px paragraph ("Gợi ý theo các agent bạn đã cài. Không mục nào bắt buộc: bỏ qua những gì không hợp với doanh nghiệp.") that is explanation, not a data legend, and it runs under the assistant dot overlay; make it a section subtitle or drop it.
Luật: `surfacecard-select-subtitle.md` (subtitle rule), `table-heroui-native-section-head.md`.
Grammar: `Text size="xs" tone="muted"`, `node_modules/@starci/grammar/dist/core/leaf/Text/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: header actions collapse to an icon-only upload button (an icon button with no label) next to ⋯, the lists stack; the middle empty card and the suggestions are not visible in the shot (the aside is below the fold), so the phone order is CHƯA RÕ.
Luật: `nivo-surface-layering.md` (below lg the aside becomes the first block), `page-header-left-sublabel-xs.md`.
Grammar: `IconButton`, `node_modules/@starci/grammar/dist/core/leaf/IconButton/index.d.ts`.
