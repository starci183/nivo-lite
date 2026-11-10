---
title: Quên mật khẩu
route: /forgot-password
area: auth-onboarding
---
# Quên mật khẩu

Block `ForgotForm` (components/blocks/ForgotForm/component.tsx) with composite `CheckEmail` for the sent state. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Next dev overlay in the shots is not product UI.

## Thanh trên cùng
Vì sao: brand + round language dropdown, as every entry page.
Luật: `locale-switch-round-dropdown.md`.
Grammar: `EntryFrame`, `node_modules/@starci/grammar/dist/core/frame/EntryFrame/index.d.ts`.

## Thẻ "Quên mật khẩu?" với trường Email
Vì sao: one card, one field, one commit button: the smallest form that does the job.
Luật: `pink-page-surface-rule.md`, `surfacecard-select-subtitle.md`.
Grammar: `SurfaceCard`, `Input`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`; composite `EmailField`.

## Nút "Gửi link đặt lại" và liên kết "Quay lại đăng nhập"
Vì sao: one commit pill and one inline link beneath it; the link leaves the flow without competing with the commit.
Luật: `owner-colors-exact.md`, `page-header-left-sublabel-xs.md` (link look).
Grammar: `Button intent="commit"`, `Link`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.

## Dòng "Nhập email, chúng tôi sẽ gửi link..." dưới thẻ
Vì sao: SAI — the instruction is a loose caption under the card (AuthPanel `note`), not a subtitle under the title; should sit under the heading.
Luật: `surfacecard-select-subtitle.md`.
Grammar: `SurfaceCard note`; fix in `components/frames/AuthPanel/index.tsx`.

## Trạng thái đã gửi (CheckEmail, không có trong shot)
Vì sao: CHƯA RÕ — the sent state (`composites/CheckEmail`) has no screenshot, so it cannot be checked against a law; take a shot after submitting.
Luật: `verify-against-visualize.md`.
Grammar: `Alert`, `TextAction`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts`.

## Chân trang pháp lý
Vì sao: SAI — same bar as login; the 390 shot wraps the links and detaches the arrows.
Luật: `page-header-left-sublabel-xs.md`.
Grammar: `NavLandmark layout="bar"`, `node_modules/@starci/grammar/dist/core/frame/NavLandmark/index.d.ts`.
