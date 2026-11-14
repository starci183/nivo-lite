---
title: Đầu vào / Hủy đơn (nút)
route: /workspaces/<ws>/inbox
area: inbox
---
Route: `/workspaces/<ws>/inbox` with the customer "Khách Zalo" open (real data of the NIVO workspace: orders DH-20261111-0006 and DH-20261111-0003 are "Chờ trả tiền"). The shot scrolls the aside to the orders. All real data, nothing mocked.

## Đơn & thanh toán: dòng đơn với nút "Hủy đơn"
Vì sao: each order of the customer is a number and value (14/500), what it holds (12 muted) and a row with its status badge (no dot: a result label) and, only on a draft or confirmed order and only for the owner or a manager (the back end refuses other seats with NOT_ALLOWED), one small "Hủy đơn" button, no icon. The entry is the danger-soft pill: CTA-4 says a destructive action is `danger-soft` at entry and solid danger only at the confirm; the ORDER-CANCEL contract asks for a "neutral" entry, the rule wins (owner question). Paid and cancelled orders show no button.
Luật: `page-header-left-sublabel-xs.md` (sm buttons carry no icon), `red-budget-links-foreground.md` (the soft entry is not the view's one red CTA; the solid red lives only in the confirm), CTA-4 (`contexts/ui/composition.md`), `badge-dot-or-not.md`, `type-scale-14-12.md`.
Grammar: `Button intent="destructive" step="entry" size="sm"` (`leaf/Button/index.d.ts`), `Badge tone`. Code: `components/branches/OrderCancelDialog/index.tsx`, `components/composites/InboxAside/index.tsx` (`Orders`).

## Phần còn lại của trang
Vì sao: unchanged; see `dau-vao/explain.md` for the header band, the customers pane, the head card, the cards of the pink well and the aside sections.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`.
Grammar: `Page chrome="panes"`, `PaneGrid`, `Pane` (`frame/Page`, `frame/PaneGrid`). Code: `components/blocks/InboxFeed/component.tsx`.

