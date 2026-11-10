---
title: Giao quyền / Nhân viên (tùy chọn)
route: /workspaces/<ws>/authority/staff
area: team-permissions
---
# Giao quyền, Nhân viên

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `AuthorityStaff` (components/blocks/AuthorityStaff/component.tsx). The shot is the EMPTY state. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang và danh sách mục (Nhân viên đang chọn)
Vì sao: SAI — same shell as the other Authority sections; blank 64px strip above the band.
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md`.
Grammar: `PageHeader`, `ListBox`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Thẻ trống "Chưa có nhân viên. Chỉ thêm khi bạn muốn giao ngoại lệ cho một người."
Vì sao: SAI — the empty state is a white card (SurfaceCard) holding only an icon tile and one sentence, with no command to add a staff member (the sentence says "add" but there is no button), and no section head; a lone sentence is never a card, and an EmptyNotice on a pane is frameless.
Luật: `table-heroui-native-section-head.md` (a lone sentence is never a card), ui-laws "EmptyNotice on a pane is frameless".
Grammar: `EmptyNotice frame="frameless" actionLabel`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`; code uses `SurfaceCard` around `EmptyNotice` (components/blocks/AuthorityStaff/component.tsx).

## Danh sách nhân viên với người duyệt (không có trong shot)
Vì sao: CHƯA RÕ — the filled state (people with exceptions) is not captured.
Luật: `verify-against-visualize.md`.
Grammar: `ListRow`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: SAI — (partly right, see the flagged part) list of sections as the page; blank strip defect.
Luật: `nivo-surface-layering.md`.
Grammar: `ListBox`.
