---
title: Kiểm tra tự động / brain-tab-knowledge-view-documents
route: audit of brain-tab-knowledge-view-documents
area: audit
---
# Kiểm tra giao diện tự động: brain-tab-knowledge-view-documents

Capture of `scripts/ui-audit` (Playwright, 17 DOM probes for the owner laws): every finding is outlined in red and labelled with its rule. This is the NEWER capture of the page, so the header band already sits directly under the top bar here. The hand-written region review of the page itself is in `brain-billing/brain-documents` (`explain.md`). Shots `1440-audit.png`, `390-audit.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Phép đo ở 1440
Vì sao: OK — the 17 probes of `scripts/ui-audit` found nothing at 1440px (font sizes, filled icons, card in card, aside flush, sm-button icons, single primary, band gap, scrollbars, raw keys, arrows); this does not prove the other laws (see brain-billing/brain-documents for the regions the probes cannot see).
Luật: `type-scale-14-12.md`, `nivo-surface-layering.md`, `table-heroui-native-section-head.md`.
Grammar: `Page`, `SurfaceCard`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Phép đo ở 390 (điện thoại)
Vì sao: SAI — the machine audit outlines filled-icon x1 at 390px (red boxes in the shot): filled-icon (an svg icon drawn with a fill and no stroke): the NIVO icon style is stroke-only (the Grammar `Icon` set); a filled glyph comes from another source (for example the pagination chevrons, the zoom + - buttons) and looks heavier than its neighbours; replace it with the stroke variant.
Luật: ui-audit rule filled-icon (owner icon style); `grammar-core-heroui.md`.
Grammar: `Icon`, `node_modules/@starci/grammar/dist/core/leaf/Icon/index.d.ts`.
