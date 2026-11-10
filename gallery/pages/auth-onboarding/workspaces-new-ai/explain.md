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

## Thẻ "Giao khách cho AI theo sát" với hai dòng cài đặt
Vì sao: one card, one list of settings: each row = noun title 14/500 + 12 muted subtitle; "Duyệt trước khi AI gửi" is a switch row with the label left and the switch at the right edge, as the switch law demands.
Luật: `surfacecard-select-subtitle.md` ("Switch rows", row titles are nouns).
Grammar: `SurfaceCard`, `Switch label description`, `node_modules/@starci/grammar/dist/core/leaf/Switch/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Dòng "Người phụ trách mặc định" với giá trị "Bạn"
Vì sao: SAI — the right side shows the plain 12px text "Bạn" with no control, so it is neither a switch nor a Select; either the assignee is not editable (then it is a fact and belongs in a muted row) or it must be a Select of members. Right now it looks like a setting that cannot be changed.
Luật: `surfacecard-select-subtitle.md` (a setting row has its control on the right).
Grammar: `Select`, `node_modules/@starci/grammar/dist/core/branch/Select/index.d.ts`, or `DescriptionList` for a fact.

## Nhãn "Tắt" cạnh công tắc
Vì sao: SAI — the switch repeats its state as a text "Tắt" to its left; the Grammar Switch already shows state by the thumb, so the extra word is noise and breaks the row layout (label left, switch right).
Luật: `surfacecard-select-subtitle.md`, `type-scale-14-12.md`.
Grammar: `Switch`, `node_modules/@starci/grammar/dist/core/leaf/Switch/index.d.ts`.

## Chân thẻ ("Quay lại", "Tiếp tục →")
Vì sao: neutral back pill left, primary commit with end arrow right in the form footer.
Luật: `table-heroui-native-section-head.md`, `page-header-left-sublabel-xs.md`.
Grammar: `SurfaceCard footers`, `Button endArrow`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.

## Dòng "AI soạn tin, bạn duyệt trước khi gửi. Mỗi khách luôn có một người phụ trách." dưới thẻ
Vì sao: SAI — loose explanatory caption under the card; it explains the settings and must be row subtitles (the rows already have subtitles saying the same).
Luật: `surfacecard-select-subtitle.md` (subtitle rule).
Grammar: `SurfaceCard note`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.
