---
title: Đặt lại mật khẩu (link hết hạn)
route: /reset-password (also /auth/reset)
area: auth-onboarding
---
# Đặt lại mật khẩu

Block `ResetForm` (components/blocks/ResetForm/component.tsx) with composite `PasswordPair`. The shot is the expired or used link state; the new-password form state has no shot. Folder `auth-reset` holds the same screen from `/auth/reset`. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Next dev overlay in the shots is not product UI.

## Thanh trên cùng
Vì sao: entry bar, brand left, round language dropdown right.
Luật: `locale-switch-round-dropdown.md`.
Grammar: `EntryFrame`, `node_modules/@starci/grammar/dist/core/frame/EntryFrame/index.d.ts`.

## Thẻ "Link không còn hiệu lực"
Vì sao: a failed link is a card whose heading states the problem and whose body is the way out; no fields because nothing can be typed against a dead token.
Luật: `pink-page-surface-rule.md`, `nivo-surface-layering.md`.
Grammar: `SurfaceCard`, `Heading level={1}`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Nút "Gửi link mới →"
Vì sao: the one primary command with the end arrow (it moves to the next screen); full-width pill primary red.
Luật: `owner-colors-exact.md`, `page-header-left-sublabel-xs.md` (icons only on primary CTAs).
Grammar: `Button endArrow intent="commit" width="fill"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.

## Liên kết "Quay lại đăng nhập"
Vì sao: standalone back link under the commit in the foreground colour (red stays for the one CTA "Gửi link mới").
Luật: `red-budget-links-foreground`, `owner-colors-exact.md`.
Grammar: `Link variant="plain"`, `node_modules/@starci/grammar/dist/core/leaf/Link/index.d.ts`.

## Dòng giải thích dưới thẻ ("Link đặt lại mật khẩu đã hết hạn hoặc đã được dùng...")
Vì sao: SAI — the reason the link failed is the key text of the screen, yet it is a 12px muted caption under the card (AuthPanel `note`); it belongs as the subtitle or an Alert inside the card under the heading.
Luật: `surfacecard-select-subtitle.md`.
Grammar: `SurfaceCard note` / `Alert`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts`; fix in `components/frames/AuthPanel/index.tsx`.

## Biểu mẫu mật khẩu mới (không có trong shot)
Vì sao: CHƯA RÕ — the valid-token state (two password fields + commit) has no screenshot; needs a shot with a valid recovery session.
Luật: `verify-against-visualize.md`.
Grammar: `Input kind="password"`, composite `PasswordPair`, `node_modules/@starci/grammar/dist/core/branch/Input/index.d.ts`.

## Chân trang pháp lý ("Chính sách quyền riêng tư", "Điều khoản sử dụng")
Vì sao: one centred bar of two standalone secondary links in the foreground colour (red is kept for the one CTA); since Grammar 0.37.14 internal links carry no arrow, so each link stays on one line at 390.
Luật: `red-budget-links-foreground`, `page-header-left-sublabel-xs.md`.
Grammar: `NavLandmark layout="bar"`, `node_modules/@starci/grammar/dist/core/frame/NavLandmark/index.d.ts`.
