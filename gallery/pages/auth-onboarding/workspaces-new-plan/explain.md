---
title: Tạo workspace / Bước 4 Gói
route: /workspaces/new/plan
area: auth-onboarding
---
# Tạo workspace, bước 4 (Gói)

Block `OnboardingPlan` (components/blocks/OnboardingPlan/component.tsx) rendering composite `PlanCards` / `PlanCatalog`. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Next dev overlay in shots is not product UI (on 390 it lands on top of the Pro card).

## Thanh trên cùng và thanh 4 bước
Vì sao: all previous steps checked, step 4 current; on 390 the Stepper becomes four progress segments with the current step's name and caption underneath.
Luật: `type-scale-14-12.md`, `nivo-surface-layering.md`.
Grammar: `Stepper`, `node_modules/@starci/grammar/dist/core/composite/Stepper/index.d.ts`.

## Tiêu đề "Chọn gói cho workspace" và đoạn mô tả
Vì sao: centred page title and a muted paragraph, the intro of a full-width step. It is centred because this is an entry flow; the "header flush left" law is for the console header band. The paragraph is a description directly under its title (allowed).
Luật: `page-header-left-sublabel-xs.md` (applies to console band only), `type-scale-14-12.md`.
Grammar: `Heading`, `Text tone="muted"`, `PageIntro`, `node_modules/@starci/grammar/dist/core/composite/PageIntro/index.d.ts`.

## Công tắc "Theo tháng / Theo năm"
Vì sao: a 2-option period switch: allowed as pill tabs ("pill = primary tabs, 2-4 mode/period switch"), not a ButtonGroup; selected item is a white raised pill on a grey track.
Luật: `surfacecard-zones-api.md` (pill = primary tabs; no button group as tabs).
Grammar: `Tabs` pill variant, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`.

## Lưới thẻ gói (Start, Pro, Max, Team, Enterprise)
Vì sao: SAI — (partly right, see the flagged part) each plan is its own SurfaceCard: header zone = name, price (figure), one command; body = the feature list with check icons. One content per card. Max has the accent ring and badge "Phổ biến nhất". SAI on three points: (1) five cards render 4 + 1 so Enterprise is orphaned on its own row although `PlanCards.columnsOf` says five or more wrap three per row (grid not honouring `columns`); (2) the order Start 245.000, Pro 792.000, Max 4.990.000, Team 400.000 is not monotonic (Team is cheaper than Pro and sits after Max): looks like placeholder data; (3) feature rows are 14 sized Text with icons but wrap to two lines unevenly, cards have unequal body height.
Luật: `nivo-surface-layering.md` (separate floating cards), `table-heroui-native-section-head.md` (one content per card), `owner-colors-exact.md` (primary ring).
Grammar: `Grid kind="cards" columns`, `SurfaceCard emphasis="accent" headers`, `Badge`, `Button intent`, `node_modules/@starci/grammar/dist/core/frame/Grid/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Nút của từng gói (Chọn Start, Chọn Pro, Chọn Max, Chọn Team, Liên hệ NIVO)
Vì sao: one command per card; only the highlighted plan is the primary commit, the others neutral, Enterprise is a neutral link to contact; none carries an icon.
Luật: `owner-colors-exact.md`, `suggestion-button-sm.md`.
Grammar: `Button intent="commit" | "neutral" width="fill"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.

## Dải "Chưa sẵn sàng trả phí? Dùng thử miễn phí." + nút "Bắt đầu dùng thử"
Vì sao: SAI — a full-width card that holds a lone sentence (icon tile, bold title, description) and a button; the law says a lone sentence is never a card; the free-trial route is an equal choice among the plans and should be a plan card ("Miễn phí") or a plain link row.
Luật: `table-heroui-native-section-head.md` (ONE CONTENT PER CARD; a lone sentence is never a card).
Grammar: `SurfaceCard`, `IconTile`, `node_modules/@starci/grammar/dist/core/leaf/IconTile/index.d.ts`; or a plan card via `PlanCards`.

## Chân trang ("Quay lại" và "Giá tham khảo. Giá và điều khoản cuối cùng do đội ngũ NIVO xác nhận.")
Vì sao: back pill left and a 12 muted legal note right; the note is a legend about the card data (prices), which is the allowed use of a caption.
Luật: `surfacecard-select-subtitle.md` (captions only for legends of the card's data), `type-scale-14-12.md`.
Grammar: `Button intent="neutral"`, `Text size="xs" tone="muted"`, `node_modules/@starci/grammar/dist/core/leaf/Text/index.d.ts`.
