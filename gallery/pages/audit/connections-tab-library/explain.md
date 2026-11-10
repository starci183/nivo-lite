---
title: Kiểm tra tự động / connections-tab-library
route: audit of connections-tab-library
area: audit
---
# Kiểm tra giao diện tự động: connections-tab-library

Capture of `scripts/ui-audit` (Playwright, 17 DOM probes for the owner laws): every finding is outlined in red and labelled with its rule. This is the NEWER capture of the page, so the header band already sits directly under the top bar here. The hand-written region review of the page itself is in `connections/thu-vien` (`explain.md`). Shots `1440-audit.png`, `390-audit.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Phép đo ở 1440
Vì sao: SAI — the machine audit outlines filled-icon x2, raw-key x1, card-in-card x10 at 1440px (red boxes in the shot): filled-icon (an svg icon drawn with a fill and no stroke): the NIVO icon style is stroke-only (the Grammar `Icon` set); a filled glyph comes from another source (for example the pagination chevrons, the zoom + - buttons) and looks heavier than its neighbours; replace it with the stroke variant; raw-key (camelCase, UUID, snake_case or a repeated word in visible text): visible text must be human words; the flagged item is "MISA meInvoice", a brand spelling (camelCase) the probe cannot tell from a raw key: a probable false positive, add it to the allow-list; card-in-card (a raised surface (shadow or border) inside another raised surface): no card in a card: one content per card, same-kind items are hairline rows of one list; nested cards must become rows or a collapsed list.
Luật: ui-audit rule filled-icon (owner icon style); `grammar-core-heroui.md`; ui-audit rule raw-key; `table-heroui-native-section-head.md` (ONE CONTENT PER CARD, no card in card).
Grammar: `Icon`, `node_modules/@starci/grammar/dist/core/leaf/Icon/index.d.ts`; `Text`, `node_modules/@starci/grammar/dist/core/leaf/Text/index.d.ts`; `SurfaceCard`, `ListRow`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`.

## Phép đo ở 390 (điện thoại)
Vì sao: SAI — the machine audit outlines filled-icon x3 at 390px (red boxes in the shot): filled-icon (an svg icon drawn with a fill and no stroke): the NIVO icon style is stroke-only (the Grammar `Icon` set); a filled glyph comes from another source (for example the pagination chevrons, the zoom + - buttons) and looks heavier than its neighbours; replace it with the stroke variant.
Luật: ui-audit rule filled-icon (owner icon style); `grammar-core-heroui.md`.
Grammar: `Icon`, `node_modules/@starci/grammar/dist/core/leaf/Icon/index.d.ts`.
