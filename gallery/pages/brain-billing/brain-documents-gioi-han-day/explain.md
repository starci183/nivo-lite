---
title: Second Brain / Tài liệu: giới hạn, đã đầy (mẫu)
route: /workspaces/<ws>/brain?tab=knowledge&view=documents
area: brain-billing
---
# Second Brain / Tài liệu: giới hạn, đã đầy (mẫu)

> MOCKED shot: the browser answers `KnowledgeUsage` (limit 20.971.520 bytes) and `KnowledgeSources` with made-up figures on the NIVO workspace; nothing is read from or written to the dev data for these figures.
State 4: the limit is used up (20 MB of 20 MB, 412 documents).

## Khung console, dải đầu trang, hai tầng tab
Vì sao: the same chrome and tab layers as the other Brain pages, unchanged by this task. The red "Thêm tài liệu" of the drawing is NOT on this tab: the header's add command (`useBrainPageActions`, `BrainHeaderActions`) is not part of the documents block, so it is not shown on this tab (it is disabled on the other tabs when the limit is full).
Luật: `nivo-surface-layering`, `page-header-left-sublabel-xs`, `red-budget-links-foreground`.
Grammar: `PageHeader` `tabs` `subTabs`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Thông báo đã dùng hết
Vì sao: a neutral `Alert` above the two cards: "Tiệm đã dùng hết 20 MB tài liệu" and the line that the AI still uses everything already here; no action (the way out is to delete documents). The limit in the title is the server's number, not typed in code. The drawing's "Thêm tài liệu" is the header's add command; it is shown on the other internal tabs (for example Chính sách) and is disabled there while the limit is used up (`limitLevelOf` = full). On the Kiến thức tabs each chip has its own header command, so no document add stands on this tab.
Luật: `red-budget-links-foreground` (informative notices are neutral), `surfacecard-select-subtitle`.
Grammar: `Alert tone="neutral"`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts`.

## Hai thẻ đo (Tài liệu đã tải lên, Sự thật AI đang dùng)
Vì sao: two SEPARATE white floating cards side by side above the list (drawing `brain-limit-50mb.png`; the limit itself is `knowledgeUsage.documents.limitBytes`, never typed in code, never the plan's storage). Each card: its name at the start and its reading at the end ("8,0 MB trên 20 MB", "142 trên 5.000 sự thật"), the meter, and a muted 12 line under it ("Còn 12,0 MB · 171 tài liệu", "0,1 MB trên 2 MB"). The fill is the FOREGROUND colour in every state (normal, from 90 %, full), never red: red is for the one main CTA. Grammar puts the reading on the name's line where the drawing stacks it under the name; the Grammar form wins.
Luật: `red-budget-links-foreground` (red = one CTA), `owner-colors-exact`, `type-scale-14-12`, `surfacecard-select-subtitle` (no loose explanation line), `pink-page-surface-rule`.
Grammar: `SurfaceCard` (body) in `Grid kind="cards"`, `Meter tone="foreground"` (0.37.38), `node_modules/@starci/grammar/dist/core/leaf/Meter/index.d.ts`.

## Danh sách tài liệu
Vì sao: unchanged by this task (rows, chips, "Xem"): see `brain-documents-trang-thai/explain.md`.
Luật: `type-scale-14-12`, `badge-dot-or-not`.
Grammar: `SurfaceCard kind="list"`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.
