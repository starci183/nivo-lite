---
title: Kết nối / Đã kết nối, chọn tài khoản nhận tiền mặc định
route: /workspaces/<ws>/connections
area: connections
---
State of `connections/hub` after the owner presses "Đổi" on "Tài khoản nhận tiền mặc định": a dialog to pick the shop's default receiving account. Shot with the picker open; it was then CANCELLED (the dev shop default was not changed; every mutation request was blocked while shooting). Block `ConnectionsHome` (`components/blocks/ConnectionsHome/defaultAccount.tsx`), hook `hooks/providerRights/useDefaultReceivingAccount.ts`. Approved drawing: `lanes/drawings/quyen-tai-khoan-2.png` (caption: "Đổi" opens the list of connected payment accounts; only the owner sees it). Grammar paths are under `node_modules/@starci/grammar/dist/core/`.

## Hộp "Chọn tài khoản nhận tiền mặc định" (danh sách chọn một)
Vì sao: a choice list is a select card, one look: a checkbox row per connected payment account whose provider can receive by QR (`qr.create`), title "<provider> · <account>" and the kind as its 12 subtitle; single choice keeps the checkbox look and the current default is checked when the dialog opens. The dev shop has one SePay account, so one row (with ONE such account it is the default by rule).
Luật: `surfacecard-select-subtitle` (every choice list is SurfaceCard kind="select", single choice = checkbox look, subtitle only under a title), `provider-rights-abilities` (the owner sets the default receiving account on Kết nối), `nivo-surface-layering` (a card on the white dialog is bordered).
Grammar: `Dialog title closeLabel footer` (`frame/Dialog/index.d.ts`), `SurfaceCard kind="select" selectionMode="single"` (`frame/SurfaceCard/index.d.ts`, `surfaceCardData.d.ts`).

## Chân hộp ("Huỷ", "Lưu")
Vì sao: the neutral "Huỷ" closes without a change; "Lưu" is the one primary of the dialog and sends `setDefaultReceivingAccount({ connectionId })` (owner only), then the board is read again; saving the account that is already the default just closes. md buttons without icons.
Luật: `red-budget-links-foreground` (one red CTA per view), `page-header-left-sublabel-xs` (only a primary CTA may have an icon; none needed here).
Grammar: `Button intent="commit" isPending` and `Button intent="neutral"` (`leaf/Button/index.d.ts`).

## Trang phía sau hộp
Vì sao: the Connected tab (explained in `connections/hub`) stays visible under the scrim so the owner keeps the context.
Luật: `pink-page-surface-rule` (chrome is not interactive under a modal).
Grammar: `Dialog` (`frame/Dialog/index.d.ts`).

## Điện thoại 390
Vì sao: the dialog keeps its side margins and the footer buttons stay at the end.
Luật: `nivo-surface-layering`.
Grammar: `Dialog` (`frame/Dialog/index.d.ts`).
