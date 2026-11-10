---
title: Quyền (Kế toán)
route: /workspaces/<ws>/agents/accounting/<installation>/connections
area: agent-connections
---
Route `/workspaces/<ws>/agents/accounting/<installation>/connections` (tab "Quyền"). Kế toán holds three accounts in three groups: Zalo OA (Nhắn tin), SePay •••• 9999 (Thanh toán, default receiving, read + rematch ticked, QR off) and Google · <the shop's Google account> (Sổ sách, read + write ticked). Block `AgentConnections` (`components/blocks/AgentConnections`) draws one well: the connected ACCOUNTS the agent holds with what it may do through each. The NIVO tools block is hidden (owner 2026-11-10, choice A) until an API returns each agent's own tool set; the shared 25-tool gateway list did not belong to any one agent. Data (per-account contract, owner 2026-11-10): `providerRights` (providers with `abilities` and `accounts[]`, `attachments` keyed by `connectionId`) and `agentAbilityProposal`; mutations `attachAgentProvider`, `detachAgentProvider`, `setAgentAbility`, all by `connectionId`. Approved drawing: `lanes/drawings/quyen-tai-khoan.png`. Grammar paths are under `node_modules/@starci/grammar/dist/core/`.

## Dải đầu trang (đường dẫn, tên agent, tab "Quyền")
Vì sao: the shared `AgentInstanceFrame` band: trail, agent name with its status chip, one tab row where the tab is "Quyền". The tab chip and the subtitle count the connected ACCOUNTS attached to this agent ("2 tài khoản"; two SePay accounts count two), read from `providerRights.attachments` of the agent. The header has no primary CTA on this tab (one red CTA at most per view). The band never scrolls.
Luật: `page-header-left-sublabel-xs` (band flush left), `table-heroui-native-section-head` (tab counts are grey 12 chips), `provider-rights-abilities` (per account).
Grammar: `Page` `header` with `tabs` (`frame/Page/index.d.ts`, `frame/PageHeader/index.d.ts`); app block `AgentInstanceFrame`, hook `hooks/installations/useInstanceCounts.ts`.

## Đầu khối "Tài khoản đã gắn" (nhãn, chip đếm, nút "Gắn thêm tài khoản")
Vì sao: the section head is ONE row: the label with its grey count chip (how many accounts the agent holds) at the start, and at the end its one action, the neutral small button "Gắn thêm tài khoản" that opens the drawer (owner 2026-11-10: a head may carry one neutral sm button). Small button, so no icon.
Luật: `table-heroui-native-section-head` (label + chip left, one action right; update 2026-11-10), `suggestion-button-sm`, `verify-against-visualize` (an sm button has no icon).
Grammar: `Section kind="region" title count action` (`frame/Section/head.d.ts`, `action` 0.37.25, lint `section-head-action`), `Button size="sm" intent="neutral"` (`leaf/Button/index.d.ts`).

## Nhóm "Nhắn tin / Thanh toán / Sổ sách" (nhãn nhỏ 12)
Vì sao: the groups only gather (they carry no right): each is a small muted 12 label above the account cards of that kind, in one flat 8px run, so the label reads as belonging to the cards under it. The words come from the back end (`kindLabel`), in the reader language.
Luật: `surfacecard-select-subtitle` (Label / Sublabel hierarchy, groups 8px), `type-scale-14-12`.
Grammar: `Sublabel` (`leaf/Sublabel/index.d.ts`) in a `Stack gap="inline"`.

## Thẻ tài khoản (logo, "<provider> · <tài khoản>", "Nhắn tin · đã nối", chip "Nhận tiền mặc định", menu ⋯)
Vì sao: one card per attached CONNECTED ACCOUNT (owner "theo từng tài khoản"): the head is the provider logo and "<provider> · <account label>" over a 12 muted "<kind> · đã nối" line. The account label comes from the back end (`accounts[].accountLabel`); when it repeats the provider name ("Google - shop@…", "SePay MB ••••5252") the leading name is dropped so the card names the provider once; when the label IS the provider name (dev shop: "Zalo OA") the title is the provider alone. The shop's default receiving account carries the green chip "Nhận tiền mặc định" (QR always goes there; the owner sets it on Kết nối). The more-menu holds "Gỡ khỏi agent" as a danger item, which asks an AlertDialog first (see `sales-quyen-go`).
Luật: `provider-rights-abilities` (one card per account, chip on the default receiving account), `surfacecard-zones-api` (a card's head is a typed zone), `table-heroui-native-section-head` (destructive command in the menu).
Grammar: `SurfaceCard kind="select" headers=[{ kind: "custom" }]`, `IdentityLockup` (`composite/IdentityLockup/index.d.ts`), `Badge tone="success"` (`leaf/Badge/index.d.ts`), `DropdownMenu` with `IconButton glyph="more"` and `DropdownMenuEntry tone="danger"` (`branch/DropdownMenu/index.d.ts`). Code: `components/composites/ProviderRightsCard`.

## Hàng quyền (ô chọn, tên việc, "Tự động | Hỏi")
Vì sao: the abilities of the account's provider as checkbox rows, the whole row clickable, full-width dividers; a tick is the right on THIS account. A WRITE ability also carries the pill "Tự động | Hỏi" as the row's `control` at the end, dimmed while the ability is off; a read ability is the checkbox alone. The row grows around the pill and keeps p-3 to the dividers. Open Grammar observation: the title sits at the top of the grown row while the pill is centred on the row, so the title is not on the pill's centre line as in the drawing.
Luật: `surfacecard-select-subtitle` (checkbox rows), `row-control-clearance` (p-4 to the edge, p-3 to a separator, the row grows), `provider-rights-abilities` (write = auto | ask; `auto` only for the owner).
Grammar: `SurfaceCard kind="select" selectionMode="multiple"` items `SelectItemData.control` (`surfaceCardData.d.ts`) holding `Tabs appearance="primary"` (`branch/Tabs/index.d.ts`).

## Thanh trên và thanh bên
Vì sao: the console shell chrome on the white surface (workspace lockup, bell, language dropdown, theme switch, account avatar; sidebar with the open destination soft pink). Nothing page-specific.
Luật: `nivo-surface-layering`, `locale-switch-round-dropdown`.
Grammar: `WorkspaceShell` `header` and `navigation` (`frame/WorkspaceShell/index.d.ts`); app blocks `ConsoleHeader`, `ConsoleNavigation`.

## Điện thoại 390: hàng mở thanh điều hướng
Vì sao: below the wide width the sidebar is a drawer opened from the row under the top bar. The cards go full width; the chip wraps under the account name; the mode pill stays at the row end and the title wraps before it.
Luật: `nivo-surface-layering` (below lg the chrome folds), `row-control-clearance`.
Grammar: `WorkspaceShell` `navigationDrawer` (`frame/WorkspaceShell/index.d.ts`).
