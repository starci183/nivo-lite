---
title: Tạo workspace / Hoàn tất
route: /workspaces/new/done
area: auth-onboarding
---
# Workspace đã sẵn sàng

Block `OnboardingReady` (components/blocks/OnboardingReady/component.tsx) on composite `CelebrationPanel`. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Next dev overlay in shots is not product UI.

## Thanh trên cùng
Vì sao: SAI — (partly right, see the flagged part) same first-run chrome as the other steps; the Stepper is gone because the flow is finished. SAI: logo "NIVO" here vs "NIVO os" on `/workspaces`.
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`.

## Hình minh hoạ (huy hiệu check với sao và ruy băng)
Vì sao: a 3D clay badge as celebration artwork, the same family as the payment receipt.
Luật: `grammar-core-heroui.md`.
Grammar: `Mascot`, `node_modules/@starci/grammar/dist/core/leaf/Mascot/index.d.ts`.

## Chip "Workspace đã sẵn sàng", tiêu đề "NIVO đã sẵn sàng", câu mô tả
Vì sao: success state = soft badge, one heading naming the workspace, one muted sentence with the first thing to do; centred as the entry flow.
Luật: `type-scale-14-12.md`.
Grammar: `Badge`, `Heading`, `Text`, `node_modules/@starci/grammar/dist/core/leaf/Badge/index.d.ts`.

## Danh sách "Bắt đầu từ đây" (3 dòng)
Vì sao: SAI — a Sublabel above one list card (correct) but each row is a link with BOTH a trailing arrow glyph in the red title AND a chevron on the right edge: two affordances for one click, and the row subtitle is muted text under a red link title. Should be a plain row (noun title 14/500 + 12 muted subtitle) with one chevron, whole row pressable, no inline link styling; the icon tiles are fine.
Luật: `table-heroui-native-section-head.md` (links: section-head "→", inline "↗"; not both on one row), `surfacecard-select-subtitle.md` (row titles are nouns).
Grammar: `SurfaceCard` + `ListRow` (`ListRowData`), `IconTile`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`.

## Nút "Vào workspace"
Vì sao: SAI — the primary commit is the only action but carries no end arrow here, while the same button after payment does; one rule needed.
Luật: `page-header-left-sublabel-xs.md`.
Grammar: `Button intent="commit" width="fill"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.
