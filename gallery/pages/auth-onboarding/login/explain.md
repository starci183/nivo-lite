---
title: Đăng nhập
route: /login
area: auth-onboarding
---
# Đăng nhập

Block `LoginForm` (fe/apps/web/src/components/blocks/LoginForm/component.tsx) inside the `(auth)` layout (`AuthLayout` -> `AuthFrame` -> Grammar `EntryFrame layout="centred"`). Shots: `1440.png`, `390.png`. The round "N" and the "Compiling..." pill at the bottom-left of every shot are the Next.js dev overlay, not product UI: retake shots from a production build (SAI of the shot, not of the page).

Grammar paths below are under `node_modules/@starci/grammar/dist/core/` (the app imports them through `@starci/grammar/common`).

## Thanh trên cùng (logo NIVO, nút ngôn ngữ)
Vì sao: the signed-out entry screen has no console chrome, only the brand on the left and the language switch on the right; the switch is the round translate icon button with a VI/EN dropdown (a Grammar-wide rule), never a pill or chips.
Luật: `locale-switch-round-dropdown.md`, `grammar-core-heroui.md`.
Grammar: `EntryFrame` props `identity` (BrandLogo) and `tools` (LocaleSwitch), `node_modules/@starci/grammar/dist/core/frame/EntryFrame/index.d.ts`.

## Thẻ đăng nhập (nền hồng, thẻ trắng nổi)
Vì sao: the entry page is the pink well with ONE floating white SurfaceCard (shadow, no border) centred, 384px wide; one card per job, no card in card.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`, ONE CONTENT PER CARD in `table-heroui-native-section-head.md`.
Grammar: `SurfaceCard` via app frame `AuthPanel`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`; `EntryFrame layout="centred"`.

## Tiêu đề "Đăng nhập NIVO OS"
Vì sao: the one heading of the page, level 1, flush left inside the card, 14/semibold scale of a card title; hierarchy by weight not size.
Luật: `type-scale-14-12.md`, `page-header-left-sublabel-xs.md` (text flush left).
Grammar: `Heading level={1}`, `node_modules/@starci/grammar/dist/core/leaf/Heading/index.d.ts`.

## Dòng "Dùng tài khoản công việc để mở workspace của bạn." dưới thẻ
Vì sao: SAI — `AuthPanel` passes the subtitle as the card `note`, so an explanatory sentence floats under the card on the pink; the law says a subtitle exists only directly under its title in the same row/card, and captions under a card are only legends of the card's data; should be the subtitle under the Heading inside the card (or dropped).
Luật: `surfacecard-select-subtitle.md` ("Subtitle rule"), `table-heroui-native-section-head.md` (a lone sentence is never a loose line).
Grammar: `SurfaceCard note`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`; fix in `components/frames/AuthPanel/index.tsx` (affects login, signup, forgot, reset, invite).

## Nút "Tiếp tục với Google" và đường kẻ "hoặc"
Vì sao: the social path is a neutral full-width md Button over a labelled Divider that splits it from the password form; neutral because the one primary command of the card is "Đăng nhập". The button has no Google glyph (only primary CTAs carry icons), which is consistent with the icon law.
Luật: `page-header-left-sublabel-xs.md` (icons only on primary CTAs), `type-scale-14-12.md`, `grammar-core-heroui.md`.
Grammar: `Button intent="neutral" width="fill" isPending`, `Divider label`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Divider/index.d.ts`.

## Trường Email và Mật khẩu (có nút "Hiện mật khẩu")
Vì sao: SAI — (partly right, see the flagged part) single fields are title (Label 14/500, red asterisk for required) + HeroUI grey input; the form sits in the card because it is one input group; the reveal control is the Grammar password Input's own text button, not hand-rolled.
Luật: `surfacecard-select-subtitle.md` (flat fields: title 14/500 + content), `grammar-core-heroui.md`, `owner-colors-exact.md` (asterisk uses the exact primary).
Grammar: `Input kind="password" revealLabel hideLabel`, `node_modules/@starci/grammar/dist/core/branch/Input/index.d.ts`; composite `EmailField`.

## Liên kết "Quên mật khẩu?"
Vì sao: a standalone secondary link, right-aligned under the password it relates to, in the foreground colour (no arrow, no red: the sign-in button is the one red call to action).
Luật: `red-budget-links-foreground` (standalone secondary link = foreground), `page-header-left-sublabel-xs.md`.
Grammar: `Link variant="plain"` (0.37.14), `node_modules/@starci/grammar/dist/core/leaf/Link/index.d.ts`.

## Nút "Đăng nhập" (chính)
Vì sao: the only commit button of the card, full width, pill, primary red; no icon because the label says the action.
Luật: `owner-colors-exact.md`, `suggestion-button-sm.md` (one pill radius for every Button).
Grammar: `Button intent="commit" width="fill" type="submit" isPending`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.

## Dòng "Chưa có tài khoản NIVO OS? Tạo tài khoản"
Vì sao: SAI — (partly right, see the flagged part) the switch to sign-up is a muted sentence plus an inline link, centred. The centring is a hand-rolled `div` with `LOGIN_CENTER_CLASS_NAME` (LoginForm/classNames), which Grammar `Cluster justify="center"` can do; the sentence is the card's footer, not a heading or caption.
Luật: `blocks-are-real-code.md`, `grammar-core-heroui.md`.
Grammar: `Cluster gap="inline"`, `Text tone="muted"`, `Link`; candidate footer zone `SurfaceCard footers`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Thông báo lỗi / chưa xác nhận email (khi có)
Vì sao: a failed sign-in or an unconfirmed address is an Alert above the form (tone negative or cautionary), with the resend link inside; never a toast, so the user can read it while retyping.
Luật: `grammar-core-heroui.md`.
Grammar: `Alert tone title description`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts`; `TextAction`.

## Chân trang pháp lý ("Chính sách quyền riêng tư", "Điều khoản sử dụng")
Vì sao: one centred bar of two standalone secondary links in the foreground colour (red is kept for the one CTA); since Grammar 0.37.14 internal links carry no arrow, so each link stays on one line at 390.
Luật: `red-budget-links-foreground` (legal links = foreground, not red), `verify-against-visualize.md`.
Grammar: `NavLandmark layout="bar"` + `Link variant="plain"`, `node_modules/@starci/grammar/dist/core/frame/NavLandmark/index.d.ts`; `EntryFrame footer`.

## Bố cục điện thoại 390
Vì sao: the card fills the width minus a 16px gutter, the logo and language button stay on the top bar, the fields keep full width; only the legal footer misbehaves (above). The card sits lower than on desktop because the centred frame keeps vertical centring.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`.
Grammar: `EntryFrame` responsive layout, `node_modules/@starci/grammar/dist/core/frame/EntryFrame/index.d.ts`.
