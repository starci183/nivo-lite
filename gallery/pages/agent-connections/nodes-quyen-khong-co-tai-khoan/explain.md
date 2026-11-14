---
title: Quyền (nodes), không có tài khoản nào để gắn
route: /workspaces/<ws>/agents/<module>/<installation>/connections
area: agent-connections
---
An agent with no attached account and no connected account to offer: the accounts card shows its empty notice ("Workspace chưa nối tài khoản nào <agent> dùng được. Nối tài khoản ở trang Kết nối rồi quay lại gắn."), count 0, and the roll-up its own empty line.

## Trống hoàn toàn
Vì sao: a card never draws an empty frame; the notice names the agent and what to do: there is nothing to attach yet, so it points to Kết nối (the earlier copy told the owner to attach an account when none existed). Shot missing: the old shot shows the earlier copy.
Luật: `empty-state` (STATE-3), `page-loading-own-shape`.
Grammar: `SurfaceCard` `empty` with `EmptyNotice`. Code: `AccountsCard` in `components/blocks/AgentConnections/component.tsx`.
