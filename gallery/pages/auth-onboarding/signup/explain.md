---
title: Tạo tài khoản
route: /signup
area: auth-onboarding
---
# Tạo tài khoản

Block `SignupForm` (components/blocks/SignupForm/component.tsx) in the same centred `EntryFrame` as login. Shots `1440.png`, `390.png`. Grammar paths are under `node_modules/@starci/grammar/dist/core/`. The Next.js dev overlay ("N", "Compiling...") in the shots is not product UI: retake from a production build.

## Thanh trên cùng (logo, nút ngôn ngữ)
Vì sao: same entry bar as login: brand left, round language dropdown right, no console chrome for a signed-out visitor.
Luật: `locale-switch-round-dropdown.md`, `grammar-core-heroui.md`.
Grammar: `EntryFrame identity tools`, `node_modules/@starci/grammar/dist/core/frame/EntryFrame/index.d.ts`.

## Thẻ và tiêu đề "Tạo tài khoản NIVO OS"
Vì sao: one white floating SurfaceCard centred on the pink well with one level-1 heading flush left; one input group per card.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`, `type-scale-14-12.md`.
Grammar: `SurfaceCard` (via `AuthPanel`), `Heading level={1}`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Các trường Họ và tên, Email, Mật khẩu, Nhập lại mật khẩu
Vì sao: four required fields, each a 14/500 label with red asterisk over a HeroUI input; both password fields use the Grammar password Input with its reveal text; the 12px muted hint "Tối thiểu 8 ký tự" is the field's own description (allowed). "Họ và tên" has no placeholder while Email has one: minor inconsistency.
Luật: `surfacecard-select-subtitle.md` (flat fields: label + description + content), `type-scale-14-12.md`.
Grammar: `Input`, `Input kind="password"`, `node_modules/@starci/grammar/dist/core/branch/Input/index.d.ts`; composites `EmailField`, `PasswordPair`.

## Nút "Tạo tài khoản"
Vì sao: the one commit button, full-width pill, primary red, no icon.
Luật: `owner-colors-exact.md`, `suggestion-button-sm.md`.
Grammar: `Button intent="commit" width="fill" type="submit"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.

## Dòng "Đã có tài khoản? Đăng nhập"
Vì sao: SAI — muted sentence + inline link centred with a hand-rolled wrapper class (as in login); should be a `Cluster justify="center"` or a `SurfaceCard` footer zone, not a custom div.
Luật: `blocks-are-real-code.md`, `grammar-core-heroui.md`.
Grammar: `Cluster`, `Text tone="muted"`, `Link`, `node_modules/@starci/grammar/dist/core/frame/Cluster/index.d.ts`.

## Dòng "Bắt đầu với workspace của riêng bạn chỉ trong một phút." dưới thẻ
Vì sao: SAI — a marketing sentence parked under the card as `note`; a subtitle exists only under a title inside the card and a caption under a card is only a legend of its data; should be the subtitle under the heading or removed.
Luật: `surfacecard-select-subtitle.md`.
Grammar: `SurfaceCard note`; fix in `components/frames/AuthPanel/index.tsx`.

## Chân trang pháp lý
Vì sao: SAI — same legal bar as login; on 390 the links wrap and the arrow detaches; each link must stay on one line.
Luật: `page-header-left-sublabel-xs.md`.
Grammar: `NavLandmark layout="bar"`, `node_modules/@starci/grammar/dist/core/frame/NavLandmark/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: single column, fields at full width, card keeps the pink gutter; nothing is hidden at 390; only the legal footer is broken.
Luật: `nivo-surface-layering.md`.
Grammar: `EntryFrame`, `node_modules/@starci/grammar/dist/core/frame/EntryFrame/index.d.ts`.
