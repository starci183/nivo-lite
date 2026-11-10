---
title: Tạo workspace / Thanh toán thành công
route: /workspaces/new/payment
area: auth-onboarding
---
# Thanh toán xong

Block `WorkspacePayment` (components/blocks/WorkspacePayment/component.tsx) with composites `CelebrationPanel` and `WorkspacePaymentDetails`. The shot is the paid (success) state; the unpaid state (bank transfer details, QR) is the loading shot in `onboarding-payment` and is not shown loaded. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Thanh trên cùng
Vì sao: SAI — (partly right, see the flagged part) white chrome bar, brand left, language dropdown and avatar right. SAI: logo is "NIVO" while `/workspaces` has "NIVO os".
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`.

## Hình minh hoạ biên lai
Vì sao: a 3D clay receipt with a check as the celebratory artwork of the success state; it is a Mascot asset with a fixed slot and checksum so it cannot be swapped silently.
Luật: `grammar-core-heroui.md`, `verify-against-visualize.md`.
Grammar: `Mascot assetSlot assetSha256`, `node_modules/@starci/grammar/dist/core/leaf/Mascot/index.d.ts`; `CelebrationPanel`.

## Chip "Đã thanh toán", tiêu đề "Thanh toán thành công", đoạn mô tả
Vì sao: success state = soft success badge, one heading, one muted sentence, centred; the sentence is the description directly under the title.
Luật: `type-scale-14-12.md`, `owner-colors-exact.md`.
Grammar: `Badge tone="success"`, `Heading`, `Text tone="muted"`, `node_modules/@starci/grammar/dist/core/leaf/Badge/index.d.ts`.

## Khối "Đơn của bạn" (Workspace: NIVO)
Vì sao: SAI — (partly right, see the flagged part) a Sublabel above a card holding one fact list (Workspace NIVO); card holds exactly one list. It shows a single row only: the plan and amount that was paid are missing, so the order summary tells the owner nothing they did not know. SAI: should list plan, period and amount paid.
Luật: `table-heroui-native-section-head.md` (Sublabel above a card, list card), `page-header-left-sublabel-xs.md`.
Grammar: `DescriptionList`, `Sublabel`, `node_modules/@starci/grammar/dist/core/composite/DescriptionList/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Sublabel/index.d.ts`; composite `WorkspacePaymentDetails`.

## Nút "Vào workspace →"
Vì sao: SAI — (partly right, see the flagged part) the one primary commit, full width, with end arrow because it moves on. The same button on the Done page has no arrow: inconsistent (SAI, choose one).
Luật: `owner-colors-exact.md`, `page-header-left-sublabel-xs.md` (icons only on primary CTA).
Grammar: `Button endArrow intent="commit" width="fill"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.
