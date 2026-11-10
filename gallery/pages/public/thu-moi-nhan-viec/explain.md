---
title: Thư mời nhận việc (lỗi tải)
route: /j/thu/<token>
area: public
---
# Phản hồi thư mời nhận việc (/j/thu/<token>)

Block `HiringOfferReply` (components/blocks/HiringOfferReply/component.tsx) in `PublicShell`. The shot is the FAILED read ("Chưa tải được thư mời"); the real offer reply screen is not shown. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Thanh trên cùng
Vì sao: SAI — "NIVO os" logo and the named text pill "Tiếng Việt"; the language switch must be the round icon dropdown.
Luật: `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`; `LocaleSwitch`.

## Thông báo lỗi "Chưa tải được thư mời" với nút "Thử lại"
Vì sao: frameless failure notice naming what failed, one neutral retry pill, centred.
Luật: ui-laws "EmptyNotice on a pane is frameless", `suggestion-button-sm.md`.
Grammar: `EmptyNotice frame="frameless"`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Dòng "Vận hành bởi NIVO."
Vì sao: standard public foot line, 12 muted.
Luật: `type-scale-14-12.md`.
Grammar: `Text size="xs" tone="muted"`, `PublicShell foot`.

## Màn thư mời đã tải (không có trong shot)
Vì sao: CHƯA RÕ — the offer card with accept and decline has no screenshot.
Luật: `verify-against-visualize.md`.
Grammar: `SurfaceCard`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.
