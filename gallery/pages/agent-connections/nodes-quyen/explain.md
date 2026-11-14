---
title: Quyền, mô hình theo bước (nodes)
route: /workspaces/<ws>/agents/<module>/<installation>/connections
area: agent-connections
---
The agent › Quyền tab when the workspace's switch says `nodeRightsDecide = true` (`useRightsModel` = "nodes"): the tick checklist is hidden and the page is two cards on the pink well: the accounts the agent may use, and the read-only roll-up of what its steps call. Drawing `lanes/drawings/rights-agent-node-provider.png`, screen 1.

## Thẻ "Tài khoản agent này được dùng" (nhãn, chip đếm, hàng tài khoản, Gỡ / Gắn, ghi chú)
Vì sao: the one thing this tab decides is WHICH connected accounts the agent may reach (what each step may call is edited per step in the workflow). One row per connected account of the workspace the agent can use: attached ones show the mark, the account's own name and "<provider> · N bước đang dùng" (N from `agentNodeRights.accounts[].stepsUsing`) with a neutral small "Gỡ" at the end; a connected account not attached shows "<provider> · chưa gắn" with a neutral small "Gắn". The count chip is the number of ATTACHED accounts. Detaching asks the existing AlertDialog first (the same confirm as before) and cuts every step off the account at once; the sentence that says so stands under the card as its note (Grammar puts a note under a card, the drawing has it at the right of the head: Grammar wins). No red on the page: the buttons are neutral, the confirm is the one overlay that already existed.
Luật: `table-heroui-native-section-head` (label + chip at the start), `suggestion-button-sm` (sm commands, no icon), `red-budget-links-foreground`, `row-control-clearance`, `pink-page-surface-rule` (white card on the pink well).
Grammar: `SurfaceCard kind="list"` with `label`, `count`, `note`, `ListRowData` (`leading.avatar`, `description`, `action intent="neutral"`, `actionPlacement="end"`), `AlertDialog` (`core/frame/AlertDialog`). Code: `components/blocks/AgentConnections`; data `useAgentNodeRights` + `useProviderRights` (`attachAgentProvider`, `detachAgentProvider`).

## Thẻ "Các bước của agent đang gọi gì" (bảng chỉ xem: Lệnh, Chế độ, Bước dùng, hàng "N lệnh khác · Xem")
Vì sao: a read-only roll-up of what the workflow steps call, so the owner sees the agent's real reach in one place and edits it where it belongs (the step). Lệnh = the title over `METHOD /path` (or the tool id) in mono 12 muted; Chế độ = one chip WITHOUT a dot, the words from `operationViewOf` ("Đọc", "Ghi · hỏi trước", "Tốn tiền · luôn hỏi trước"; danger is said by words, never by colour); Bước dùng = "workflow › bước", a foreground link to that step (`workflowStepPath`). The count chip is the number of rows the API sent; the first three show and the rest fold into the last row "N lệnh khác · Xem", N = the API's row count less the rows shown. "Xem" opens every row. The note "Chỉ xem. Sửa ở từng bước trong workflow." stands under the card.
Luật: `table-heroui-native-section-head`, `badge-dot-or-not` (a result label is a plain Badge), `red-budget-links-foreground` (standalone link = foreground), `type-scale-14-12`.
Grammar: `SurfaceCard kind="table"` (`label`, `count`, `note`, `footers: [{ kind: "more" }]`), `Badge`, `Link variant="plain"`, `Text mono` (`leaf/Text`). Code: `components/blocks/AgentStepRights`.

## Chênh với bản vẽ
Vì sao: (1) the head note is under each card, not at the right of the head (Grammar: a head has a count and one Link, a note stands under the card). (2) The mark is the provider's logo or the default avatar, not a letter tile. (3) The step link is 14 / 500 (the plain link weight), the drawing has it regular. (4) The step names are `workflow › nodeKey` until the base resolves the step's label. (5) The table is the card itself (Grammar 0.37.38: white card, no grey frame).

## Update 2026-11-13 (rights.md)
The roll-up's mode chip is the mode of the node that calls the operation (`auto | ask`): no "luôn hỏi trước" chip, no "chờ chủ duyệt" chip, no waiting notice above the table and no consent dialog (the upgrade gate is gone). The tick board (`ticks` model) and its attach drawer are deleted (`nodeRightsDecide` is constant true), so the tab is these two cards plus the NIVO tools section (its grant badge and the blocked reason are gone: a tool is usable when an attached account serves it). Old shots still show the removed chips: shots missing.

## Update (PL-4 polish)
The NIVO tools rows name the accounts a provider tool goes through with the node-mode words ("<provider> · <account> · tự làm" / "hỏi trước", the same words as the roll-up chip), not the old ability words "Tự động" / "Hỏi"; the reasons a tool is not usable say "chưa gắn tài khoản nào cho ..." (no more "chưa tick"). Shots missing for those lines.
