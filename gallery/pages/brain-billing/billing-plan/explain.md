---
title: Đổi gói
route: /workspaces/<ws>/billing/plan
area: brain-billing
---
# Đổi gói (billing/plan)

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `BillingPlanChange` (components/blocks/BillingPlanChange/component.tsx) with composites `PlanCards` and `PlanCatalog`. Shots `1440.png`, `390.png`, `390-bottom.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Thanh trên cùng và thanh bên
Vì sao: same console chrome as billing (white top bar, white sidebar, current item "Credit & gói" as a pink pill).
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`.

## Dải đầu trang (Tổng quan / Credit & gói / Đổi gói, tiêu đề, mô tả)
Vì sao: SAI — same band defect as billing: a blank 64px pink strip above the band, and the sticky band overlaps the first control (the period tabs are cut off behind it at y 277). The band content (3-level breadcrumb, title, sublabel) is flush left and right.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`, `page-header-left-sublabel-xs.md`.
Grammar: `Page header`, `Breadcrumbs`, `node_modules/@starci/grammar/dist/core/composite/Breadcrumbs/index.d.ts`.

## Công tắc chu kỳ "Theo tháng / Theo năm" (bị dải che mất)
Vì sao: SAI — a period switch is correct as pill-primary `Tabs` (2 options, not a button group), but in the shot it is hidden under the sticky band so the user cannot see which cycle is selected; the layout must reserve space for it.
Luật: `surfacecard-zones-api.md` (pill = primary tabs for 2-4 period switch; no button group as tabs).
Grammar: `Tabs appearance="primary"`, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`.

## Lưới thẻ gói (Start, Pro, Max, Team, Enterprise)
Vì sao: SAI — each plan is a separate SurfaceCard with name, price and ONE command (correct), but: (1) every card says "Nâng lên X", including Team at 400.000 which is cheaper than Pro, so "upgrade" is false; (2) the card in use should be ringed and marked ("Gói hiện tại"), but the workspace has no plan so nothing is marked; (3) each card lists only 2 features here while the same plans list 6-9 on the onboarding step: two sources of truth; (4) Enterprise has an empty body; (5) the grid is 3 + 2 here but 4 + 1 on onboarding.
Luật: `nivo-surface-layering.md` (separate floating cards), `table-heroui-native-section-head.md` (one content per card), `owner-colors-exact.md`.
Grammar: `Grid kind="cards" columns`, `SurfaceCard`, `node_modules/@starci/grammar/dist/core/frame/Grid/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`; composite `PlanCards` (`PlanOfferCard`).

## Nút "Nâng lên …" và "Liên hệ NIVO"
Vì sao: SAI — all five are neutral outlined md buttons, no primary commit, so nothing guides the choice; the onboarding step marks the recommended plan with the primary button. Should mark the recommended or current plan consistently.
Luật: `owner-colors-exact.md`, `suggestion-button-sm.md`.
Grammar: `Button intent="commit" | "neutral"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.

## Dòng "Gói mới có hiệu lực khi tiền về. Enterprise do đội ngũ NIVO báo giá theo hợp đồng."
Vì sao: a 14 muted note under the plans; it explains payment terms for the card data (prices), the allowed use of a caption, but it is 14 and not the 12 legend size.
Luật: `surfacecard-select-subtitle.md` (captions for legends only), `type-scale-14-12.md`.
Grammar: `Text size="xs" tone="muted"`, `node_modules/@starci/grammar/dist/core/leaf/Text/index.d.ts`.

## Thẻ tóm tắt thay đổi (khi chọn gói, không có trong shot)
Vì sao: CHƯA RÕ — `SummaryCard` (details card with the change facts and footer commands Huỷ / Thanh toán) appears only after a plan is chosen; no screenshot shows it.
Luật: `surfacecard-zones-api.md` (footers), `verify-against-visualize.md`.
Grammar: `SurfaceCard kind="details" footers`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: plans stack one per column, each full width; the "⋯" nav row, a blank strip, then the band; the tabs are again cut under the band.
Luật: `nivo-surface-layering.md`.
Grammar: `Grid kind="cards"`.
