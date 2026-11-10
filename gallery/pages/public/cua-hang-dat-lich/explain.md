---
title: Trang đặt lịch của cửa hàng (lỗi tải)
route: /b/<slug>
area: public
---
# Trang đặt lịch công khai (/b/<slug>)

Block `PublicBookingContent` (components/blocks/PublicBookingContent/component.tsx) in `PublicShell`; the data comes through `SlotView`. The shot is the FAILED read state ("Chưa tải được phần này. Hãy thử lại."): the booking page itself (shop identity rail + booking form) is not shown loaded. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. The red "2 Issues" Next overlay is dev tooling, not UI.

## Thanh trên cùng
Vì sao: SAI — platform logo "NIVO os" (no shop was read) and the named text pill "Tiếng Việt" for the language; the owner rule fixes the language switch as the round icon dropdown.
Luật: `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`; use `LocaleSwitch`, not `LanguageMenu isNamed`.

## Thông báo lỗi "Chưa tải được phần này. Hãy thử lại." với nút "Thử lại"
Vì sao: a failed read is a frameless empty notice centred in the page with a warning icon tile, a message, a sentence and one neutral retry pill; frameless because the notice stands directly on the pink (EmptyNotice on a pane is frameless). The message is generic ("phần này") while the sibling public pages say what failed ("lời mời", "thư mời"): inconsistent copy.
Luật: ui-laws "EmptyNotice on a pane is frameless", `suggestion-button-sm.md` (neutral pill button), `type-scale-14-12.md`.
Grammar: `EmptyNotice frame="frameless" iconSource actionLabel`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`; `SlotView` retry.

## Dòng chân trang "Vận hành bởi NIVO."
Vì sao: standard public foot line, 12 muted, centred.
Luật: `type-scale-14-12.md`.
Grammar: `Text size="xs" tone="muted"`, `PublicShell foot`.

## Trang đặt lịch khi tải xong (không có trong shot)
Vì sao: CHƯA RÕ — the real page (rail with the shop `PageIntro` and avatar beside the `PublicBookingForm` in `Grid`) has no screenshot here; it cannot be judged.
Luật: `verify-against-visualize.md`.
Grammar: `Grid rail`, `PageIntro`, `Avatar`, `node_modules/@starci/grammar/dist/core/frame/Grid/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/PageIntro/index.d.ts`.
