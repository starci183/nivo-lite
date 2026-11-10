---
title: Kiểm tra tự động / agent-sales-chat
route: audit of agent-sales-chat
area: audit
---
# Kiểm tra giao diện tự động: agent-sales-chat

Capture of `scripts/ui-audit` (Playwright, 17 DOM probes for the owner laws): every finding is outlined in red and labelled with its rule. This is the NEWER capture of the page, so the header band already sits directly under the top bar here. The hand-written region review of the page itself is in `agent-* areas (workbench, work, setup, chat, connections, knowledge) of another lane` (`explain.md`). Shots `1440-audit.png`, `390-audit.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Phép đo ở 1440
Vì sao: SAI — the machine audit outlines btn-sm-icon x2, btn-sm-icon-only x2 at 1440px (red boxes in the shot): btn-sm-icon (a size="sm" button with a label AND an icon): sm buttons never carry an icon, even primary; remove the icon or use size md for a primary CTA; btn-sm-icon-only (a size="sm" icon-only button): reported case by case: an icon-only sm button is acceptable only for a section-head ⓘ or a dismiss; every other one needs a text label or must be an `IconButton` with an aria-label and a tooltip.
Luật: `page-header-left-sublabel-xs.md` (sm buttons no icon); ui-audit rule btn-sm-icon-only; `page-header-left-sublabel-xs.md`.
Grammar: `Button size="sm"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`; `IconButton`, `node_modules/@starci/grammar/dist/core/leaf/IconButton/index.d.ts`.

## Phép đo ở 390 (điện thoại)
Vì sao: SAI — the machine audit outlines filled-icon x1, hidden-under-band x1, btn-sm-icon-only x2, btn-sm-icon x1, font-size x1 at 390px (red boxes in the shot): filled-icon (an svg icon drawn with a fill and no stroke): the NIVO icon style is stroke-only (the Grammar `Icon` set); a filled glyph comes from another source (for example the pagination chevrons, the zoom + - buttons) and looks heavier than its neighbours; replace it with the stroke variant; hidden-under-band (content under the sticky header band at scroll 0): the first control or row sits partly under the band; the pane needs top padding equal to the band; btn-sm-icon-only (a size="sm" icon-only button): reported case by case: an icon-only sm button is acceptable only for a section-head ⓘ or a dismiss; every other one needs a text label or must be an `IconButton` with an aria-label and a tooltip; btn-sm-icon (a size="sm" button with a label AND an icon): sm buttons never carry an icon, even primary; remove the icon or use size md for a primary CTA; font-size (visible text whose computed size is not 12, 14, 18 or 20 px): only 14 (all text) and 12 (small names) exist, with 18 for the page title and 20 for big figures; any other size is a hand-set value; use the Grammar Text sizes.
Luật: ui-audit rule filled-icon (owner icon style); `grammar-core-heroui.md`; `pink-page-surface-rule.md` (header band never scrolls away, content starts under it); ui-audit rule btn-sm-icon-only; `page-header-left-sublabel-xs.md`; `page-header-left-sublabel-xs.md` (sm buttons no icon); `type-scale-14-12.md`.
Grammar: `Icon`, `node_modules/@starci/grammar/dist/core/leaf/Icon/index.d.ts`; `Page header`, `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`; `IconButton`, `node_modules/@starci/grammar/dist/core/leaf/IconButton/index.d.ts`; `Button size="sm"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`; `Text size`, `node_modules/@starci/grammar/dist/core/leaf/Text/index.d.ts`.
