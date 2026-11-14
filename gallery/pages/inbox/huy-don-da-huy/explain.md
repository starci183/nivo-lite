---
title: Đầu vào / Hủy đơn (đã hủy)
route: /workspaces/<ws>/inbox
area: inbox
---
Route: `/workspaces/<ws>/inbox`. MOCKED: the `CancelOrder` answer is `cancelled` and the customer read afterwards is patched in the browser so DH-20261111-0006 reads "Đã hủy"; dev data is never mutated.

## Kết quả đã hủy
Vì sao: after `cancelled` (or a harmless `already_cancelled`) the founder gets one success toast ("Đã hủy đơn DH-…"), the opened customer and the list are read again, and the order shows the existing "Đã hủy" badge with no button (a cancelled order has nothing left to cancel).
Luật: `badge-dot-or-not.md` (result label, no dot), `toast-alert.choose.owner` feedback for a finished action.
Grammar: `toast` (`modules/toast`), `Badge tone`. Code: `hooks/inbox/useOrderCancel.ts`, `components/composites/InboxAside/index.tsx`.

