---
title: Kiểm tra tự động / agent-accounting-setup~quy-trinh
route: audit of agent-accounting-setup (tab quy-trinh)
area: audit
---
# Kiểm tra giao diện tự động: agent-accounting-setup~quy-trinh

Capture of `scripts/ui-audit` (Playwright, 17 DOM probes for the owner laws): every finding is outlined in red and labelled with its rule. This is the NEWER capture of the page, so the header band already sits directly under the top bar here. The hand-written region review of the page itself is in `agent-* areas (workbench, work, setup, chat, connections, knowledge) of another lane` (`explain.md`). Shots `1440-audit.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Phép đo ở 1440
Vì sao: SAI — the machine audit outlines filled-icon x3 at 1440px (red boxes in the shot): filled-icon (an svg icon drawn with a fill and no stroke): the NIVO icon style is stroke-only (the Grammar `Icon` set); a filled glyph comes from another source (for example the pagination chevrons, the zoom + - buttons) and looks heavier than its neighbours; replace it with the stroke variant.
Luật: ui-audit rule filled-icon (owner icon style); `grammar-core-heroui.md`.
Grammar: `Icon`, `node_modules/@starci/grammar/dist/core/leaf/Icon/index.d.ts`.

## Phép đo ở 390 (điện thoại)
Vì sao: CHƯA RÕ — no 390 audit capture exists for this folder, so the phone layout was not measured.
Luật: `verify-against-visualize.md`.
Grammar: `Page`, `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`.
