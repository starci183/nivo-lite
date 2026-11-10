---
title: Kiểm tra tự động / agent-accounting-setup
route: audit of agent-accounting-setup
area: audit
---
# Kiểm tra giao diện tự động: agent-accounting-setup

Capture of `scripts/ui-audit` (Playwright, 17 DOM probes for the owner laws): every finding is outlined in red and labelled with its rule. This is the NEWER capture of the page, so the header band already sits directly under the top bar here. The hand-written region review of the page itself is in `agent-* areas (workbench, work, setup, chat, connections, knowledge) of another lane` (`explain.md`). Shots `1440-audit.png`, `390-audit.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Phép đo ở 1440
Vì sao: OK — the 17 probes of `scripts/ui-audit` found nothing at 1440px (font sizes, filled icons, card in card, aside flush, sm-button icons, single primary, band gap, scrollbars, raw keys, arrows); this does not prove the other laws (see agent-* areas (workbench, work, setup, chat, connections, knowledge) of another lane for the regions the probes cannot see).
Luật: `type-scale-14-12.md`, `nivo-surface-layering.md`, `table-heroui-native-section-head.md`.
Grammar: `Page`, `SurfaceCard`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Phép đo ở 390 (điện thoại)
Vì sao: SAI — the machine audit outlines filled-icon x1, font-size x1 at 390px (red boxes in the shot): filled-icon (an svg icon drawn with a fill and no stroke): the NIVO icon style is stroke-only (the Grammar `Icon` set); a filled glyph comes from another source (for example the pagination chevrons, the zoom + - buttons) and looks heavier than its neighbours; replace it with the stroke variant; font-size (visible text whose computed size is not 12, 14, 18 or 20 px): only 14 (all text) and 12 (small names) exist, with 18 for the page title and 20 for big figures; any other size is a hand-set value; use the Grammar Text sizes.
Luật: ui-audit rule filled-icon (owner icon style); `grammar-core-heroui.md`; `type-scale-14-12.md`.
Grammar: `Icon`, `node_modules/@starci/grammar/dist/core/leaf/Icon/index.d.ts`; `Text size`, `node_modules/@starci/grammar/dist/core/leaf/Text/index.d.ts`.
