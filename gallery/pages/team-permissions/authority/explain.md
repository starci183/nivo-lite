---
title: Giao quyền (mặc định = Mục tiêu)
route: /workspaces/<ws>/authority
area: team-permissions
---
# Giao quyền (mục mặc định)

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

The route `/authority` renders the first section (Mục tiêu), so this folder shows the same screen as `authority-goals`; superseded by `authority-goals`. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Toàn trang (danh sách mục + thẻ Mục tiêu)
Vì sao: SAI — identical to `authority-goals/explain.md`: blank 64px strip above the band, `NumberField` steppers on VND values, a loose caption under the card; the duplicate folder exists because `/authority` and `/authority/goals` are two URLs for one view (should redirect).
Luật: `table-heroui-native-section-head.md`, `surfacecard-select-subtitle.md`.
Grammar: `ListBox`, `NumberField`, `SurfaceCard`, `node_modules/@starci/grammar/dist/core/leaf/NumberField/index.d.ts`.
