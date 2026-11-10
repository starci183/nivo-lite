---
title: Liên kết xác nhận email (/auth/confirm)
route: /auth/confirm
area: auth-onboarding
---
# /auth/confirm

The shot shows the sign-in card (the confirm route lands on `/login` once the token is consumed), so it duplicates `login`; superseded by `login`. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Toàn trang (thẻ đăng nhập sau xác nhận)
Vì sao: SAI — the shot has no confirmation-specific region: `LoginForm` supports an affirmative `notice` Alert ("đã xác nhận email") but none is drawn; should show it above the form. All other regions are in `login/explain.md`.
Luật: `verify-against-visualize.md`, `grammar-core-heroui.md`.
Grammar: `Alert tone="affirmative"`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts`; `EntryFrame`.
