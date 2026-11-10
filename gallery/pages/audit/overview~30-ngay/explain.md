---
title: Kiểm tra tự động / overview~30-ngay
route: audit of overview (tab 30-ngay)
area: audit
---
# Kiểm tra giao diện tự động: overview~30-ngay

Capture of `scripts/ui-audit` (Playwright, 17 DOM probes for the owner laws): every finding is outlined in red and labelled with its rule. This is the NEWER capture of the page, so the header band already sits directly under the top bar here. The hand-written region review of the page itself is in `overview/overview` (`explain.md`). Shots `1440-audit.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Phép đo ở 1440
Vì sao: SAI — the machine audit outlines description-under-label x2, btn-sm-icon-only x1 at 1440px (red boxes in the shot): description-under-label (a sentence next to or under a section head label): a section head holds the label (+ count chip) and one → link or ⓘ; a description beside it must become a 12 caption under the card or a row subtitle; btn-sm-icon-only (a size="sm" icon-only button): reported case by case: an icon-only sm button is acceptable only for a section-head ⓘ or a dismiss; every other one needs a text label or must be an `IconButton` with an aria-label and a tooltip.
Luật: `table-heroui-native-section-head.md` (section head: no description); ui-audit rule btn-sm-icon-only; `page-header-left-sublabel-xs.md`.
Grammar: `PaneHeader`, `node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts`; `IconButton`, `node_modules/@starci/grammar/dist/core/leaf/IconButton/index.d.ts`.

## Phép đo ở 390 (điện thoại)
Vì sao: CHƯA RÕ — no 390 audit capture exists for this folder, so the phone layout was not measured.
Luật: `verify-against-visualize.md`.
Grammar: `Page`, `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`.
