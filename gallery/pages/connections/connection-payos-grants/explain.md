---
title: Kết nối payOS, phần "Agent dùng" (bản chụp trùng)
route: /workspaces/<ws>/connections/open/<id>
area: connections
---
# payOS, phần cấp quyền cho agent

Twin capture of `payos-chi-tiet-open`; superseded by it. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Cột trái (chỉ khối "Thông tin kết nối", không còn nút nổi)
Vì sao: the floating "Giao cho agent" pill was the old per-connection level picker (`ConnectionAccessMenu`) and is gone with the level (K-BLK 2026-11-10); with no agent bound the overview shows no agents block (`ConnectionAgents isHiddenWhenEmpty`), binding lives on the Agent tab and rights on the agent's Quyền tab. The left column now starts with the facts card level with the rail head.
Luật: `provider-rights-abilities.md`, `pink-page-surface-rule.md` (no loose control on the well).
Grammar: `Grid kind="main-rail"`, `Stack gap="region"`, `node_modules/@starci/grammar/dist/core/frame/Grid/index.d.ts`; block `ConnectionOpenContent` (draws nothing when the row has nothing to say).

## Phần còn lại của trang
Vì sao: SAI — as `payos-chi-tiet-open/explain.md` (two-row facts card with no information, empty events as a card).
Luật: `table-heroui-native-section-head.md`.
Grammar: `DescriptionList`, `EmptyNotice`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.
