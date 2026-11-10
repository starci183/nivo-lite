---
title: Quyền (Bán hàng)
route: /workspaces/<ws>/agents/sales/<installation>/connections
area: agent-connections
---
Route `/workspaces/<ws>/agents/sales/<installation>/connections`; the route keeps its old segment, only the tab label changed from "Kết nối" to "Quyền" (`modulesCore.tab_connections`). Block `AgentConnections` (`components/blocks/AgentConnections`) draws one well: the providers the agent holds with what it may do through each, then the NIVO tools. Data: `providerRights` (providers, abilities, attachments) and `agentAbilityProposal`, mutations `attachAgentProvider`, `detachAgentProvider`, `setAgentAbility`; tools: `mcpToolGrants` / `setMcpToolGrant`. The pink well, the Next dev overlays (round N, Compiling pill) and the floating assistant button are not page content. Grammar paths are under `node_modules/@starci/grammar/dist/core/`.

## Dải đầu trang (đường dẫn, tên agent, tab "Quyền")
Vì sao: the shared `AgentInstanceFrame` band, owned by the agent-frame lane: trail, agent name with its status chip, one tab row where the former "Kết nối" tab is now "Quyền" (rights are what the tab holds: provider abilities and NIVO tools). The band never scrolls.
Luật: `page-header-left-sublabel-xs` (band flush left), `table-heroui-native-section-head` (tab counts are chips).
Grammar: `Page` `header` with `tabs` (`frame/Page/index.d.ts`, `frame/PageHeader/index.d.ts`); app block `AgentInstanceFrame`.

## Đầu khối "Provider đã gắn" (nhãn, chip đếm, nút "Gắn thêm provider")
Vì sao: a section head is the label with its grey count chip at the start (how many providers the agent holds). The command "Gắn thêm provider" is a neutral small pill right-aligned under the head: Grammar's `Section` head takes only a head Link or an info IconButton (lint `section-head-action`), so the pill cannot stand in the head row itself (gap told to the owner). Small button, so no icon.
Luật: `table-heroui-native-section-head` (label + chip left), `suggestion-button-sm` and `verify-against-visualize` (an sm button has no icon).
Grammar: `Section kind="region" title count` (`frame/Section/head.d.ts`), `Button size="sm" intent="neutral"` (`leaf/Button/index.d.ts`).

## Nhóm "Nhắn tin / Thanh toán / Sổ sách" (nhãn nhỏ 12)
Vì sao: the groups only group the display (they carry no level): each is a small muted 12 label above its cards, and the labels and cards are one flat 8px run, so the label reads as belonging to the cards under it. The group words come from the back end (`kindLabel`), in the reader language.
Luật: `surfacecard-select-subtitle` (Label / Sublabel hierarchy, groups 8px), `type-scale-14-12`.
Grammar: `Sublabel` (`leaf/Sublabel/index.d.ts`) in a `Stack gap="inline"`.

## Thẻ provider (logo, tên, "Nhắn tin · đã nối", menu ⋯)
Vì sao: one card per attached provider. The head is the provider logo and name over a 12 muted "kind · đã nối" line; the more-menu at the end holds "Gỡ khỏi agent" as a danger item (destructive commands are never a visible button at rest), and it asks an AlertDialog first (see `sales-quyen-go`). The account name is not shown because the API does not send one yet (asked of backend F10).
Luật: `surfacecard-zones-api` (a card's head is a typed zone), `table-heroui-native-section-head` (destructive command in the menu, danger tone).
Grammar: `SurfaceCard kind="select" headers=[{ kind: "custom" }]`, `IdentityLockup` (`composite/IdentityLockup/index.d.ts`), `DropdownMenu` with `IconButton glyph="more"` and `DropdownMenuEntry tone="danger"` (`branch/DropdownMenu/index.d.ts`).

## Hàng quyền (ô chọn, tên việc, "Tự động | Hỏi")
Vì sao: every choice list is a select card: a checkbox row per ability of the provider, the whole row clickable, full-width dividers. A tick turns the ability on. A WRITE ability (it changes something outside NIVO, e.g. "Gửi tin cho khách") also carries the pill "Tự động | Hỏi" at the row end, dimmed while the ability is off; a read ability is the checkbox alone (its tick means automatic). The owner's final model: the tick is the right, there are no policy switches on this tab.
Luật: `surfacecard-select-subtitle` (one look: checkbox rows, subtitle only under a title), `surfacecard-zones-api` (a pill is a 2-4 option mode switch).
Grammar: `SurfaceCard kind="select" selectionMode="multiple" items: SelectItemData` with `control` (Grammar 0.37.13+, `surfaceCardData.d.ts`) holding `Tabs appearance="primary"` (`branch/Tabs/index.d.ts`). Open lint finding: `tabs-switch-zone` flags the pill written in JSX; a Grammar exception for a select row `control` is pending with the owner.

## Thẻ provider chưa nối (chỉ có liên kết "Nối ở Kết nối →")
Vì sao: a provider attached to the agent whose connection is gone shows no abilities (nothing can run), only its head and a head Link to the Connections page.
Luật: `table-heroui-native-section-head` (navigation is a head Link with the sliding arrow).
Grammar: `SurfaceCard kind="body"`, `Link variant="head"` (`leaf/Link/index.d.ts`).

## Khối "Công cụ NIVO" (chip n / m, "Quy định ở Second Brain →")
Vì sao: the NIVO tools the agent may call are a choice card named by its label, with the count of tools on as a chip "n / m" and one head link to where the business rules live (the Second Brain). Rules (quy định) are what the AI reasons about, never switches here.
Luật: `surfacecard-select-subtitle`, `table-heroui-native-section-head` (label + chip left, one link right).
Grammar: `SurfaceCard kind="select" label fact labelEnd={<Link variant="head">}` (`frame/SurfaceCard/index.d.ts`, `surfaceCardData.d.ts` `CardHead`).

## Thanh trên và thanh bên
Vì sao: the console shell chrome on the white surface (workspace lockup, round language dropdown, theme switch, account avatar; sidebar with the open destination soft pink). Nothing page-specific.
Luật: `nivo-surface-layering`, `locale-switch-round-dropdown`.
Grammar: `WorkspaceShell` `header` and `navigation` (`frame/WorkspaceShell/index.d.ts`); app blocks `ConsoleHeader`, `ConsoleNavigation`.

## Điện thoại 390: hàng mở thanh điều hướng
Vì sao: below the wide width the sidebar is a drawer; `WorkspaceShell` draws its opener in a row under the top bar. The cards go full width and the mode pill stays at the row end.
Luật: `nivo-surface-layering` (below lg the chrome folds).
Grammar: `WorkspaceShell` `navigationDrawer` (`frame/WorkspaceShell/index.d.ts`).
