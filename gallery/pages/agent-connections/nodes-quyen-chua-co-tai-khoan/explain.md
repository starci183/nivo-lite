---
title: Quyền (nodes), chưa gắn tài khoản nào
route: /workspaces/<ws>/agents/<module>/<installation>/connections
area: agent-connections
---
An agent with no attached account while the workspace has connected ones: the count is 0, every row says "chưa gắn" with a neutral small "Gắn", and the roll-up says plainly that no step calls anything yet.

## Chưa gắn tài khoản
Vì sao: the way forward is on the row itself (Gắn); the count chip reads 0 and the roll-up card, which can only be empty without an account, keeps its heads and says "Chưa bước nào của agent gọi lệnh nào." instead of an empty frame.
Luật: `suggestion-button-sm`, `page-loading-own-shape`.
Grammar: `SurfaceCard kind="list"` / `kind="table"` `empty` (`EmptyNotice`). Code: `rightsPageOf` (`AgentConnections/view.ts`).
