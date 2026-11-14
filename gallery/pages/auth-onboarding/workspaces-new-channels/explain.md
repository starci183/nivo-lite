---
title: Tạo workspace / Bước 2 Kênh
route: /workspaces/new/channels
area: auth-onboarding
---
# Tạo workspace, bước 2 (Kênh)

Block `OnboardingChannels` (components/blocks/OnboardingChannels/component.tsx) on frame `FirstRunCard`. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Next dev overlay in shots is not product UI.

## Thanh trên cùng và thanh 4 bước
Vì sao: SAI — (partly right, see the flagged part) same first-run top bar and Stepper as step 1: step 1 is a check, step 2 is the current red mark, the track fills to it. SAI on the bar: logo is "NIVO" here but "NIVO os" on `/workspaces`.
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`, `type-scale-14-12.md`.
Grammar: `Stepper`, `node_modules/@starci/grammar/dist/core/composite/Stepper/index.d.ts`; `TopBar`.

## Thẻ "Khách nhắn bạn ở đâu?" với 3 dòng kênh (Zalo OA, Telegram, SePay)
Vì sao: one card, one list: each row = brand tile, noun title 14/500, 12 muted subtitle and a status chip "Đã kết nối" on the right; rows separated by full-width hairlines; same-kind items stay in one list. When a channel is not connected the right side is a Button (code path `Button` in the block) so the row is both state and command. This is a choice-like list but not `kind="select"` since a row connects a channel rather than ticking one.
Luật: `surfacecard-select-subtitle.md` (row titles are nouns, subtitle under title), `table-heroui-native-section-head.md` (one content per card; hairline rows).
Grammar: `SurfaceCard` + `ListRow` (`ListRowData`), `Badge`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Badge/index.d.ts`; `FirstRunCard`.

## Chân thẻ ("Về sảnh", "Tiếp tục →")
Vì sao: form footer zone: neutral pill left, primary commit with end arrow right; the arrow says it continues the flow.
Luật: `table-heroui-native-section-head.md`, `page-header-left-sublabel-xs.md`.
Grammar: `SurfaceCard footers`, `Button endArrow`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.

## Dòng "Kết nối ít nhất một kênh để AI đọc tin khách. Bạn có thể làm sau."
Vì sao: since 2026-11-13 (PL-6) it is the muted subtitle under the question inside the card header (`FirstRunCard`), not a caption under the card. The step offers channels so the AI can READ customers; it does not promise any inbox page (/inbox is retired).
Luật: `surfacecard-select-subtitle.md` (subtitle under a title).
Grammar: `Heading` + `Text tone="muted"` in `SurfaceCard headers`.

## Trạng thái chưa có kênh nào / lỗi (không có trong shot)
Vì sao: CHƯA RÕ — the block draws an `EmptyNotice` when the list fails; every channel in the shot is already connected so the interesting states (not connected: a Button per row; empty) are not shown.
Luật: `verify-against-visualize.md`.
Grammar: `EmptyNotice`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.
