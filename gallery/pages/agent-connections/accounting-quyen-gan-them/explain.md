---
title: Quyền (Kế toán), ngăn "Gắn thêm tài khoản"
route: /workspaces/<ws>/agents/accounting/<installation>/connections
area: agent-connections
---
State of `agent-connections/accounting-quyen` after "Gắn thêm tài khoản" is pressed. Kế toán already holds every connected account of the dev shop that has abilities, so the drawer shows its empty notice "Mọi tài khoản đã nối đều đã gắn cho agent này." (the list card's required empty state). Grammar paths are under `node_modules/@starci/grammar/dist/core/`.

## Ngăn "Gắn thêm tài khoản" (tiêu đề, nút đóng, danh sách hoặc thông báo trống)
Vì sao: with nothing left to attach the list card shows its EmptyNotice instead of rows (every list answers for its empty state). Otherwise: an overlay on the white surface for a secondary task. The body is one list card: one row per CONNECTED account the agent does not hold yet whose provider has abilities (pending connections and payOS, which has none, are not offered). Each row: the provider logo, "<provider> · <account>", the consequence line "<kind> · đã nối" (a messaging account adds what the agent misses, e.g. "Sales chưa trả lời OA này"), and its own neutral "Gắn" at the row end. "Gắn" attaches that account with what the template proposes for it (`agentAbilityProposal`; a non-default payment account or a provider outside the template comes with nothing ticked) and the row leaves the list; the drawer stays open for the next one. No footer: every row carries its own command, so there is no second primary.
Luật: `provider-rights-abilities` (unattached accounts live in this drawer), `suggestion-button-sm` (neutral row pill), `red-budget-links-foreground` (no extra red CTA), `nivo-surface-layering` (a card on the white drawer is bordered).
Grammar: `Drawer` (`frame/Drawer/index.d.ts`), `EmptyNotice` (`composite/EmptyNotice/index.d.ts`) as the list's `empty`, `SurfaceCard kind="list"` rows `ListRowData` with `leading.avatar`, `actionPlacement="end"`, `action intent="neutral"` (`surfaceCardData.d.ts`). Code: `components/blocks/AgentConnections/component.tsx` (`AttachDrawer`).

## Trang phía sau ngăn
Vì sao: the Quyền tab stays visible under the scrim so the owner keeps the context (explained in the `-quyen` folder of the same agent).
Luật: `pink-page-surface-rule` (chrome is not interactive under a modal).
Grammar: `Drawer` (`frame/Drawer/index.d.ts`).

## Điện thoại 390
Vì sao: the drawer takes the full width as a sheet; the row keeps the "Gắn" pill at its end and the title wraps before it.
Luật: `nivo-surface-layering`.
Grammar: `Drawer` (`frame/Drawer/index.d.ts`).
