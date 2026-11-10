---
title: Nâng cao (khóa API, webhook)
route: /workspaces/<ws>/developers
area: team-permissions
---
# Nâng cao (developers)

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `DevelopersPanel` (components/blocks/DevelopersPanel/component.tsx) with sections `ApiKeysSection`, `McpGatewaySection`, `ApiQuickStart`. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang ("Nâng cao" / mô tả)
Vì sao: SAI — breadcrumb Tổng quan / Nâng cao and the title "Nâng cao" while the route and the sidebar do not list it (the sidebar has no "Nâng cao" item, so the user cannot reach this page from the menu); sublabel flush left; blank 64px strip above the band; the first card is clipped under the sticky band.
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md`.
Grammar: `PageHeader`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Thẻ "n8n / Webhook" (biểu tượng, mô tả, nút "Kết nối") và dòng chú thích
Vì sao: SAI — a single row card (icon tile, title, a 14 muted sentence, neutral sm "Kết nối") with no section label above it while the next block has one ("Khoá API"); the sentence under the title is long and the 12px paragraph under the card repeats it in other words ("Khi shop có việc mới ... NIVO gửi một tin có chữ ký tới địa chỉ bạn chọn"): a loose explanation, not a legend.
Luật: `surfacecard-select-subtitle.md` (subtitle only under a title in the same row), `table-heroui-native-section-head.md` (Sublabel above each card).
Grammar: `SurfaceCard` + `ListRow`, `Button size="sm"`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`.

## Khối "Khoá API": ô tên khoá, nút "+ Tạo khoá", dòng chú thích
Vì sao: SAI — a card holding one input and a button in a row (an input group with an inline submit, acceptable), but the "Tạo khoá" button is drawn as a washed-out light pink with a plus icon (disabled with no name typed; a disabled primary at that size looks broken) and it is a primary md button with an icon beside an input (the sm-no-icon rule applies to sm only). The 12px paragraph below the card ("Khoá cho phép công cụ khác đọc và ghi dữ liệu của shop. Mỗi công cụ nên có một khoá riêng...") is a loose explanation.
Luật: `surfacecard-select-subtitle.md` (subtitle rule), `page-header-left-sublabel-xs.md` (icons only on primary CTAs), `owner-colors-exact.md` (exact primary, not a tinted substitute).
Grammar: `Input`, `Button intent="commit" isDisabled`, `node_modules/@starci/grammar/dist/core/branch/Input/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`; composite `ConnectionCopyInput`.

## Thẻ trống "Chưa có khoá nào. Khi một công cụ cần, hãy tạo khoá ở trên."
Vì sao: SAI — a white card holding a single sentence and an icon; the keys list should be one list card whose empty state is inside it (frameless EmptyNotice) under the head "Khoá API", not a second card below the input card.
Luật: `table-heroui-native-section-head.md` (a lone sentence is never a card; one content per card), ui-laws "EmptyNotice on a pane is frameless".
Grammar: `EmptyNotice`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Thẻ "Hướng dẫn nhanh" (đóng) với "Địa chỉ gốc, header, 2 ví dụ"
Vì sao: a collapsed disclosure card (title left, summary right) that expands into code blocks (`FencedCodeBlock`); sensible for reference material, but it is a card with a title and a muted summary on the same row, i.e. a description beside a label.
Luật: `table-heroui-native-section-head.md` (head: label left, right = one thing: link or ⓘ; no description).
Grammar: `Disclosure`, `FencedCodeBlock`, `node_modules/@starci/grammar/dist/core/branch/Disclosure/index.d.ts`; composite `ApiQuickStart`.

## Phần MCP gateway (không có trong shot)
Vì sao: CHƯA RÕ — `McpGatewaySection` / `McpGatewayRegion` is not displayed for this workspace, so it is unchecked.
Luật: `verify-against-visualize.md`.
Grammar: `Section`, `node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: single column; nav row, blank strip and band; the input and the "Tạo khoá" button stack.
Luật: `nivo-surface-layering.md`.
Grammar: `PaneGrid`.
