---
title: Kiểm tra tự động / brain-tab-knowledge-view-documents~cong-khai
route: audit of brain-tab-knowledge-view-documents (tab cong-khai)
area: audit
---
# Kiểm tra giao diện tự động: brain-tab-knowledge-view-documents~cong-khai

Capture of `scripts/ui-audit` (Playwright, 17 DOM probes for the owner laws): every finding is outlined in red and labelled with its rule. This is the NEWER capture of the page, so the header band already sits directly under the top bar here. The hand-written region review of the page itself is in `brain-billing/brain-documents` (`explain.md`). Shots `1440-audit.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Phép đo ở 1440
Vì sao: SAI — the machine audit outlines description-under-label x1, filled-icon x2 at 1440px (red boxes in the shot): description-under-label (a sentence next to or under a section head label): a section head holds the label (+ count chip) and one → link or ⓘ; a description beside it must become a 12 caption under the card or a row subtitle; filled-icon (an svg icon drawn with a fill and no stroke): the NIVO icon style is stroke-only (the Grammar `Icon` set); a filled glyph comes from another source (for example the pagination chevrons, the zoom + - buttons) and looks heavier than its neighbours; replace it with the stroke variant.
Luật: `table-heroui-native-section-head.md` (section head: no description); ui-audit rule filled-icon (owner icon style); `grammar-core-heroui.md`.
Grammar: `PaneHeader`, `node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts`; `Icon`, `node_modules/@starci/grammar/dist/core/leaf/Icon/index.d.ts`.

## Phép đo ở 390 (điện thoại)
Vì sao: CHƯA RÕ — no 390 audit capture exists for this folder, so the phone layout was not measured.
Luật: `verify-against-visualize.md`.
Grammar: `Page`, `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`.
