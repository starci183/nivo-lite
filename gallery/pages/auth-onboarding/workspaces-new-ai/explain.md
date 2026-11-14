---
title: Tạo workspace / Bước 3 Giao cho AI
route: /workspaces/new/ai
area: auth-onboarding
---
# Tạo workspace, bước 3 (Giao cho AI)

Block `OnboardingHandover` (components/blocks/OnboardingHandover/component.tsx) on `FirstRunCard`. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Next dev overlay in shots is not product UI.

## Thanh trên cùng và thanh 4 bước
Vì sao: SAI — (partly right, see the flagged part) steps 1 and 2 are checks, step 3 is the current mark; same chrome as the other steps. SAI: logo is "NIVO" while `/workspaces` shows "NIVO os".
Luật: `nivo-surface-layering.md`, `type-scale-14-12.md`.
Grammar: `Stepper`, `node_modules/@starci/grammar/dist/core/composite/Stepper/index.d.ts`.

## Thẻ "Giao khách cho AI theo sát" với hai dòng sự thật
Vì sao: one card, one list of two FACTS read live (no switch any more: the rights model moved the auto / ask choice to each step of a workflow): "Người phụ trách mặc định" with the owner's name as muted meta, and "Cách AI gửi cho khách" (a noun title) with what the steps that send to a customer declare now ("Có bước hỏi trước" / "Các bước tự làm" / "Chưa bước nào gửi cho khách"); the row subtitle says where to change it. The line under the heading says "this is how the AI works with customers right now" (it no longer promises that the owner approves before every send).
Luật: `surfacecard-select-subtitle.md` (row titles are nouns), `type-scale-14-12.md`.
Grammar: `SurfaceCard kind="list"` (`ListRowData` with `meta`), `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Dòng "Người phụ trách mặc định" với giá trị "Bạn"
Vì sao: SAI — the right side shows the plain 12px text "Bạn" with no control, so it is neither a switch nor a Select; either the assignee is not editable (then it is a fact and belongs in a muted row) or it must be a Select of members. Right now it looks like a setting that cannot be changed.
Luật: `surfacecard-select-subtitle.md` (a setting row has its control on the right).
Grammar: `Select`, `node_modules/@starci/grammar/dist/core/branch/Select/index.d.ts`, or `DescriptionList` for a fact.


## Chân thẻ ("Quay lại", "Tiếp tục →")
Vì sao: neutral back pill left, primary commit with end arrow right in the form footer.
Luật: `table-heroui-native-section-head.md`, `page-header-left-sublabel-xs.md`.
Grammar: `SurfaceCard footers`, `Button endArrow`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.

## Dòng mô tả dưới tiêu đề
Vì sao: since 2026-11-13 (PL-6) the description is the muted subtitle UNDER the heading inside the card header (`FirstRunCard`), not a loose caption under the card; same for the channels step.
Luật: `surfacecard-select-subtitle.md` (subtitle only under a title).
Grammar: `Heading` + `Text tone="muted"` in the header zone of `SurfaceCard headers`.
