---
title: Lời mời vào workspace (/invite/<token>)
route: /invite/zzz-invalid-token
area: auth-onboarding
---
# Lời mời vào workspace

Block `InviteOverview` (components/blocks/InviteOverview/component.tsx) on `AuthPanel`. The shot is the LOADING skeleton frozen: with the invalid token `zzz` the page never reached its "invalid invitation" state, so the real states (valid invite, invalid, expired) are not shown. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Thanh trên cùng
Vì sao: entry bar, brand left, round language dropdown right.
Luật: `locale-switch-round-dropdown.md`.
Grammar: `EntryFrame`, `node_modules/@starci/grammar/dist/core/frame/EntryFrame/index.d.ts`.

## Thẻ lời mời đang tải (tiêu đề, Vai trò, Dành cho, nút)
Vì sao: SAI — the skeleton is the correct first-read state (heading and the DescriptionList rows "Vai trò" / "Dành cho" draw as skeleton, the action as a skeleton pill), but the shot never leaves it; an invalid token must resolve to a failure card with a way out ("Về trang đăng nhập"), so either the page hangs on a bad token or the shot was taken too early. Should resolve to the invalid state.
Luật: `verify-against-visualize.md`, ui-laws loading skeleton rules.
Grammar: `DescriptionList items isLoading`, `node_modules/@starci/grammar/dist/core/composite/DescriptionList/index.d.ts`; `Button endArrow isLoading`; `Heading isLoading`.

## Chân trang pháp lý ("Chính sách quyền riêng tư", "Điều khoản sử dụng")
Vì sao: one centred bar of two standalone secondary links in the foreground colour (red is kept for the one CTA); since Grammar 0.37.14 internal links carry no arrow, so each link stays on one line at 390.
Luật: `red-budget-links-foreground`, `page-header-left-sublabel-xs.md`.
Grammar: `NavLandmark layout="bar"`, `node_modules/@starci/grammar/dist/core/frame/NavLandmark/index.d.ts`.
