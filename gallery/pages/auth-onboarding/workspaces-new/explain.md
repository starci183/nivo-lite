---
title: Tạo workspace / Bước 1 Doanh nghiệp
route: /workspaces/new
area: auth-onboarding
---
# Tạo workspace, bước 1 (Doanh nghiệp)

Block `WorkspaceCreate` (components/blocks/WorkspaceCreate/component.tsx) inside the first-run layout (`FirstRunLayout`, steps layout `workspaces/new/(steps)/layout.tsx`). Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Next dev overlay in shots is not product UI.

## Thanh trên cùng (logo, ngôn ngữ, avatar)
Vì sao: SAI — (partly right, see the flagged part) white chrome bar with brand, round language dropdown and avatar. SAI: the logo is plain "NIVO" here but "NIVO os" on `/workspaces`; one `BrandLogo` variant per shell.
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`.

## Thanh tiến trình 4 bước (Doanh nghiệp, Kênh, Giao cho AI, Gói)
Vì sao: a horizontal Stepper: each step = numbered mark, name (14/500) and a 12 muted caption; done steps are check marks joined by a primary line. It sits flat on the pink well (not in a card) because it is navigation chrome of the flow. On 390 it collapses to four segments plus the current step's name.
Luật: `type-scale-14-12.md`, `nivo-surface-layering.md`, `owner-colors-exact.md` (primary red for the current mark and filled track).
Grammar: `Stepper completeMarker="check"`, `node_modules/@starci/grammar/dist/core/composite/Stepper/index.d.ts`; app `FirstRunStep`.

## Thẻ "Doanh nghiệp của bạn tên gì?" (tiêu đề, mô tả, hai trường)
Vì sao: one input group in one card: title with its subtitle directly under it, a divider, then fields "Tên doanh nghiệp" (required, with the 12 muted hint "Thường là tên doanh nghiệp của bạn. Có thể đổi sau.") and "Ngành" (Select). Subtitle under a title and a hint under its own field are both allowed.
Luật: `surfacecard-select-subtitle.md`, `surfacecard-zones-api.md` (header zone + body), `table-heroui-native-section-head.md` (one content per card).
Grammar: `SurfaceCard headers`, `Input`, `Select`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/Select/index.d.ts`.

## Chân thẻ ("Về sảnh", "Tiếp tục")
Vì sao: SAI — (partly right, see the flagged part) the form footer inside the card, Cancel-like neutral pill on the left and the primary commit pill on the right; "Tiếp tục" carries no arrow here while steps 2 and 3 show an arrow on the same button: inconsistent (SAI: pick one; owner rule icons only on primary CTAs, so it should have the arrow on every step or none).
Luật: `table-heroui-native-section-head.md` (form footer Huỷ/Lưu), `page-header-left-sublabel-xs.md`.
Grammar: `SurfaceCard footers` (custom), `Button intent="neutral"` / `intent="commit"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.
