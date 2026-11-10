---
title: Quyền (Bán hàng), ngăn "Gắn thêm provider"
route: /workspaces/<ws>/agents/sales/<installation>/connections
area: agent-connections
---
State of `agent-connections/sales-quyen` after "Gắn thêm provider" is pressed: a right drawer lists the connected providers the agent does not hold yet. Block `AgentConnections`. Grammar paths are under `node_modules/@starci/grammar/dist/core/`; the page behind the drawer is the dimmed Quyền tab (explained in `sales-quyen`).

## Ngăn "Gắn thêm provider" (tiêu đề, nút đóng, danh sách provider)
Vì sao: an overlay on the white surface for a secondary task. The body is one choice card (single choice: checkbox look, one row checked): the title is the provider name and the subtitle its kind. Providers that are not connected, or that have no ability (payOS today), are not offered: attaching is refused for them. Choosing a provider and pressing "Gắn" adds its card with the template defaults.
Luật: `surfacecard-select-subtitle` (every choice list is SurfaceCard kind="select", single choice keeps the checkbox look), `nivo-surface-layering` (drawer on the surface, so the card is bordered).
Grammar: `Drawer` (`frame/Drawer/index.d.ts`), `SurfaceCard kind="select" selectionMode="single"` (`frame/SurfaceCard/index.d.ts`).

## Chân ngăn ("Huỷ", "Gắn")
Vì sao: the footer holds the neutral "Huỷ" and the ONE primary "Gắn", disabled until a provider is picked. The primary is md, so it may carry an icon; here it is text only.
Luật: `page-header-left-sublabel-xs` (only a primary CTA at md/lg may have an icon), `verify-against-visualize`.
Grammar: `Button intent="commit"` and `Button intent="neutral"` (`leaf/Button/index.d.ts`).

## Trang phía sau ngăn
Vì sao: the Quyền tab stays visible under the 50% scrim so the owner keeps the context.
Luật: `pink-page-surface-rule` (chrome is not interactive under a modal).
Grammar: `Drawer` (`frame/Drawer/index.d.ts`).
