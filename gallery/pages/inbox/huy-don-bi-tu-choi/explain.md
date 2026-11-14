---
title: Đầu vào / Hủy đơn (bị từ chối vì có tiền)
route: /workspaces/<ws>/inbox
area: inbox
---
Route: `/workspaces/<ws>/inbox`. MOCKED: the `CancelOrder` answer is `refused / order_has_money` with the numbers of DH-20261111-0006 (received 4.000 đ, one matched transfer); dev data is never mutated (the shot helper blocks every mutation, the page answers the call in the browser).

## Báo kết quả dưới dòng đơn
Vì sao: the back end refused because money came in, so nothing was cancelled and the founder is told so in place, under that order: a neutral `Alert` ("Không hủy được: đơn đã nhận 4.000 đ" over "Hoàn tiền là việc của tiệm; NIVO chưa hủy gì.") that the founder can close, then the transfers that came in as a bordered list ("Tiền đã về": amount over a 12 muted line "Đã khớp với đơn · 11/11 21:07"). It is an inline region, not a modal: information that does not block. Neutral, not red: the red budget belongs to the one main CTA. Other refusals (order missing, invoiced, not cancellable) read one sentence in the same Alert with no list.
Luật: `stop-card-design.md` (surface in surface: inner lists bordered), `red-budget-links-foreground.md` (Alert neutral), `dialog-drawer.md` ("inform" row: an inline region), `type-scale-14-12.md`, dates dd/MM.
Grammar: `Alert tone="neutral" dismissLabel onDismiss` (`core/composite/Alert/index.d.ts`), `SurfaceCard kind="list" label items` (`frame/SurfaceCard`). Code: `components/composites/InboxAside/index.tsx` (`Refusal`), words `orderCancel` namespace.

