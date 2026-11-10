---
title: Kiểm tra tự động / agent-accounting-performance
route: audit of agent-accounting-performance
area: audit
---
# Kiểm tra giao diện tự động: agent-accounting-performance

Capture of `scripts/ui-audit` (Playwright, 17 DOM probes for the owner laws): every finding is outlined in red and labelled with its rule. This is the NEWER capture of the page, so the header band already sits directly under the top bar here. The hand-written region review of the page itself is in `agent-* areas (workbench, work, setup, chat, connections, knowledge) of another lane` (`explain.md`). Shots `1440-audit.png`, `390-audit.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Phép đo ở 1440
Vì sao: SAI — the machine audit outlines btn-sm-icon x1 at 1440px (red boxes in the shot): btn-sm-icon (a size="sm" button with a label AND an icon): sm buttons never carry an icon, even primary; remove the icon or use size md for a primary CTA.
Luật: `page-header-left-sublabel-xs.md` (sm buttons no icon).
Grammar: `Button size="sm"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.

## Phép đo ở 390 (điện thoại)
Vì sao: SAI — the machine audit outlines btn-sm-icon x1 at 390px (red boxes in the shot): btn-sm-icon (a size="sm" button with a label AND an icon): sm buttons never carry an icon, even primary; remove the icon or use size md for a primary CTA.
Luật: `page-header-left-sublabel-xs.md` (sm buttons no icon).
Grammar: `Button size="sm"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.
