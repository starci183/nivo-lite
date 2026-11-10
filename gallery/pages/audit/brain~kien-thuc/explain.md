---
title: Kiểm tra tự động / brain~kien-thuc
route: audit of brain (tab kien-thuc)
area: audit
---
# Kiểm tra giao diện tự động: brain~kien-thuc

Capture of `scripts/ui-audit` (Playwright, 17 DOM probes for the owner laws): every finding is outlined in red and labelled with its rule. This is the NEWER capture of the page, so the header band already sits directly under the top bar here. The hand-written region review of the page itself is in `brain-billing/brain-todo` (`explain.md`). Shots `1440-audit.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Phép đo ở 1440
Vì sao: SAI — the machine audit outlines aside-not-flush x1, card-in-card x1, filled-icon x3 at 1440px (red boxes in the shot): aside-not-flush (the right pane of a pane layout ends more than 2px short of the viewport edge): the aside is a full-height white pane flush with the right edge and a left border; here it stops short (it is drawn as a card in the well); card-in-card (a raised surface (shadow or border) inside another raised surface): no card in a card: one content per card, same-kind items are hairline rows of one list; nested cards must become rows or a collapsed list; filled-icon (an svg icon drawn with a fill and no stroke): the NIVO icon style is stroke-only (the Grammar `Icon` set); a filled glyph comes from another source (for example the pagination chevrons, the zoom + - buttons) and looks heavier than its neighbours; replace it with the stroke variant.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`; `table-heroui-native-section-head.md` (ONE CONTENT PER CARD, no card in card); ui-audit rule filled-icon (owner icon style); `grammar-core-heroui.md`.
Grammar: `Pane area="aside" surface`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`; `SurfaceCard`, `ListRow`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`; `Icon`, `node_modules/@starci/grammar/dist/core/leaf/Icon/index.d.ts`.

## Phép đo ở 390 (điện thoại)
Vì sao: CHƯA RÕ — no 390 audit capture exists for this folder, so the phone layout was not measured.
Luật: `verify-against-visualize.md`.
Grammar: `Page`, `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`.
