---
title: Second Brain / Tài liệu: giới hạn, từ 90 % (mẫu)
route: /workspaces/<ws>/brain?tab=knowledge&view=documents
area: brain-billing
---
# Second Brain / Tài liệu: giới hạn, từ 90 % (mẫu)

> MOCKED shot: the browser answers `KnowledgeUsage` (limit 20.971.520 bytes) and `KnowledgeSources` with made-up figures on the NIVO workspace; nothing is read from or written to the dev data for these figures.
State 2: from 90 % used (18,5 MB of 20 MB). Only the line under the documents card changes ("Còn 1,5 MB. Xoá tài liệu cũ để có thêm chỗ."): no notice, no colour change.

## Khung console, dải đầu trang, hai tầng tab
Vì sao: the same chrome and tab layers as the other Brain pages, unchanged by this task. The red "Thêm tài liệu" of the drawing is NOT on this tab: the header's add command (`useBrainPageActions`, `BrainHeaderActions`) is not part of the documents block, so it is not shown on this tab (it is disabled on the other tabs when the limit is full).
Luật: `nivo-surface-layering`, `page-header-left-sublabel-xs`, `red-budget-links-foreground`.
Grammar: `PageHeader` `tabs` `subTabs`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Hai thẻ đo (Tài liệu đã tải lên, Sự thật AI đang dùng)
Vì sao: two SEPARATE white floating cards side by side above the list (drawing `brain-limit-50mb.png`; the limit itself is `knowledgeUsage.documents.limitBytes`, never typed in code, never the plan's storage). Each card: its name at the start and its reading at the end ("8,0 MB trên 20 MB", "142 trên 5.000 sự thật"), the meter, and a muted 12 line under it ("Còn 12,0 MB · 171 tài liệu", "0,1 MB trên 2 MB"). The fill is the FOREGROUND colour in every state (normal, from 90 %, full), never red: red is for the one main CTA. Grammar puts the reading on the name's line where the drawing stacks it under the name; the Grammar form wins.
Luật: `red-budget-links-foreground` (red = one CTA), `owner-colors-exact`, `type-scale-14-12`, `surfacecard-select-subtitle` (no loose explanation line), `pink-page-surface-rule`.
Grammar: `SurfaceCard` (body) in `Grid kind="cards"`, `Meter tone="foreground"` (0.37.38), `node_modules/@starci/grammar/dist/core/leaf/Meter/index.d.ts`.

## Danh sách tài liệu
Vì sao: unchanged by this task (rows, chips, "Xem"): see `brain-documents-trang-thai/explain.md`.
Luật: `type-scale-14-12`, `badge-dot-or-not`.
Grammar: `SurfaceCard kind="list"`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.
