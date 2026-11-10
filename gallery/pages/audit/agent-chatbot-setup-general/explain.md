---
title: Kiểm tra tự động / agent-chatbot-setup-general
route: audit of agent-chatbot-setup-general
area: audit
---
# Kiểm tra giao diện tự động: agent-chatbot-setup-general

Capture of `scripts/ui-audit` (Playwright, 17 DOM probes for the owner laws): every finding is outlined in red and labelled with its rule. This is the NEWER capture of the page, so the header band already sits directly under the top bar here. The hand-written region review of the page itself is in `agent-* areas (workbench, work, setup, chat, connections, knowledge) of another lane` (`explain.md`). Shots `1440-audit.png`, `390-audit.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Phép đo ở 1440
Vì sao: OK — the 17 probes of `scripts/ui-audit` found nothing at 1440px (font sizes, filled icons, card in card, aside flush, sm-button icons, single primary, band gap, scrollbars, raw keys, arrows); this does not prove the other laws (see agent-* areas (workbench, work, setup, chat, connections, knowledge) of another lane for the regions the probes cannot see).
Luật: `type-scale-14-12.md`, `nivo-surface-layering.md`, `table-heroui-native-section-head.md`.
Grammar: `Page`, `SurfaceCard`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Phép đo ở 390 (điện thoại)
Vì sao: OK — the 17 probes of `scripts/ui-audit` found nothing at 390px (font sizes, filled icons, card in card, aside flush, sm-button icons, single primary, band gap, scrollbars, raw keys, arrows); this does not prove the other laws (see agent-* areas (workbench, work, setup, chat, connections, knowledge) of another lane for the regions the probes cannot see).
Luật: `type-scale-14-12.md`, `nivo-surface-layering.md`, `table-heroui-native-section-head.md`.
Grammar: `Page`, `SurfaceCard`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.
