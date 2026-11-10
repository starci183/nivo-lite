---
title: Kết nối / Google Drive (trùng trang Google)
route: /workspaces/<ws>/connections/drive
area: connections
---
# Drive (trùng với Google)

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

The route `/connections/drive` renders the same Google account page; superseded by `google` (every region is explained there). This older shot still has the blank 64px strip above the band at 1440. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Toàn trang (như `google`)
Vì sao: SAI — identical to `google/explain.md` (two-content setup card, description beside the "Dịch vụ" label, aside as a floating card) plus the blank pink strip above the band in this capture and the first card clipped under the sticky band; two URLs for one page.
Luật: `table-heroui-native-section-head.md`, `nivo-surface-layering.md`.
Grammar: `PageHeader`, `Stepper`, `SurfaceCard`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.
