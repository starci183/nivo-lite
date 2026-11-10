---
title: Thanh toán bằng chuyển khoản (đang tải)
route: /onboarding/payment -> /workspaces/new/payment
area: auth-onboarding
---
# Thanh toán chuyển khoản, trạng thái đang tải

Old url `/onboarding/payment` forwards to `/workspaces/new/payment`; the shot is the payment page before its data arrived (`WorkspacePayment` block). Superseded by `workspaces-new-payment` (the loaded state). Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Thanh trên cùng (logo "NIVO", ngôn ngữ, avatar)
Vì sao: SAI — (partly right, see the flagged part) white top bar with the logo, round language dropdown and the Sprout avatar. SAI: the logo here is plain "NIVO" while the `/workspaces` bar draws "NIVO os".
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`; `BrandLogo`.

## Dải đầu trang (đường dẫn "Workspace của bạn / Thanh toán bằng chuyển khoản", tiêu đề skeleton)
Vì sao: the header band shows the breadcrumb (parent muted, current weight 500) and a skeleton title while the workspace name loads; band is white with a bottom border and flush left.
Luật: `page-header-left-sublabel-xs.md`, `pink-page-surface-rule.md`.
Grammar: `Page header`, `Breadcrumbs`, `node_modules/@starci/grammar/dist/core/composite/Breadcrumbs/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`.

## Dòng "Đang tải thông tin thanh toán..."
Vì sao: SAI — the first read is a grey pill with a spinner and a sentence, while the loading law is skeletons of the real shape (heading, details list, QR) so the page does not jump; the loader should be the skeleton of the loaded blocks.
Luật: ui-laws loading skeleton rules, `verify-against-visualize.md`.
Grammar: `Skeleton`, `Spinner`, `node_modules/@starci/grammar/dist/core/leaf/Skeleton/index.d.ts`; `isLoading` props on `Text`/`Heading`.
