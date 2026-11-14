---
title: Đầu vào / Hủy đơn (hỏi lại)
route: /workspaces/<ws>/inbox
area: inbox
---
Route: `/workspaces/<ws>/inbox`, "Hủy đơn" pressed on DH-20261111-0006. Real page and real order, nothing sent.

## Hộp hỏi "Hủy đơn DH-…?"
Vì sao: an irreversible action needs its confirmation, so an `AlertDialog`: the question as the title, one sentence of consequence ("Đơn và các nhắc việc của đơn sẽ dừng. Không hủy được đơn đã có tiền về."), then the decision group: "Giữ đơn" first (dismiss, focused: initial focus sits on the safe choice) and the solid danger "Hủy đơn" last; the dialog holds no commit of its own and an outside press does not close it. The solid button is the only place the red appears for this action. While the call runs the confirm pends and the dialog stays open.
Luật: CTA-4 (`contexts/ui/composition.md`), `dialog-drawer.choose.role` confirm row (`contexts/ui/components/dialog-drawer.md`), `red-budget-links-foreground.md`.
Grammar: `AlertDialog title tone="negative" cancelLabel confirmLabel onConfirm trigger` (`core/frame/AlertDialog/index.d.ts`; `onConfirm` returns a promise). Code: `components/branches/OrderCancelDialog/index.tsx`.

## Trang phía sau
Vì sao: dimmed and inert behind the backdrop; the same page as `huy-don`.
Luật: `dialog-drawer.md` (the page behind is inert).
Grammar: `AlertDialog` backdrop. Code: `components/branches/OrderCancelDialog/index.tsx`.


## Điện thoại 390: hộp hỏi mở từ ngăn kéo "Thông tin khách"
Vì sao: below the wide width the aside is a `Drawer`; the confirm `AlertDialog` opened from a button inside it now stacks above the drawer sheet (Grammar 0.37.38 overlay stacking; before it the dialog sat behind the sheet and was invisible). On the phone the decision group stacks full width: the solid danger "Hủy đơn" first, "Giữ đơn" under it, and the dismiss button still takes the initial focus.
Luật: `dialog-drawer.md` (the overlay is the view while open), CTA-4.
Grammar: `AlertDialog` opened from inside `Drawer`, `node_modules/@starci/grammar/dist/core/frame/AlertDialog/index.d.ts`, `core/frame/Drawer/index.d.ts`.
