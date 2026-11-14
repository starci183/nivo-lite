---
title: Đầu vào
route: /workspaces/<ws>/inbox
area: inbox
---
Route: `/workspaces/<ws>/inbox`. Everything NIVO received, as a three-pane workspace: customers (white column), the opened customer's cards (pink well), the customer's facts (white aside, a drawer below the wide width). The shot has the first customer open (Trần Cẩm). The detail journey card is below the fold of the 1440 shot and is described from code.

Grammar paths are under `node_modules/@starci/grammar/dist/core/`. Screens are the console shell (`ConsoleLayout`, a `WorkspaceShell`) around one route page. Shots are taken in the Next dev server (the round "N" button, "Compiling" and "1 Issue" pills are Next dev overlays, not app UI; retake with `devIndicators: false`).

## Header band (trail, title, summary line, two commands)
Vì sao: the band is flush left on the white surface: trail, title "Đầu vào" (18), one 12 muted summary line of facts ("21 khách 7 ngày · 4 mới hôm nay · 3 cần bạn · 25% tự trả lời"; "·" only joins words of a meta line, so it is allowed) and two header commands at the end: "Gắn form website" (opens the website drawer) and "Mở Kết nối →" (navigates, hence the arrow), both `alternative` md pills with no icon. The code comment still says the first command "is a globe"; no icon is drawn, the comment is stale. Phone: the trail, title, summary and the two buttons stack flush left; with a customer open the band collapses (`headerCollapse="narrow"`).
Luật: `page-header-left-sublabel-xs.md` (band flush left; 12 meta), `table-heroui-native-section-head.md` ("·" only joins words in meta lines; pink counts for owner work), `type-scale-14-12.md`.
Grammar: `Page chrome="panes" header={{ breadcrumbs, title, meta, actions }}` (`frame/Page/index.d.ts`, `PagePanesProps`), `Button intent="alternative" endArrow` (`leaf/Button`). Code: `components/blocks/InboxFeed/component.tsx` (`HeaderActions`).

## Customers pane: filter tabs (Tất cả 21, Mới 11, Cần bạn 3, +2)
Vì sao: SAI — one row of filter tabs with a 12px count chip each, the surplus folded into "+2 ⌄" (a menu), the underline on the pane's separator. Defect: "Cần bạn 3" is the work waiting on the owner, so its chip must be the pink attention chip (`isAttention`), but `listViewOf` (`modules/inbox/rows.ts`) passes no `isAttention`, so every chip is grey; the catalog page does it right for its "Có sự thật chờ duyệt" tab. Also `Tabs kind="filter"` is documented at 13px in its d.ts, and the law forbids 13.
Luật: `table-heroui-native-section-head.md` (tab counts: always a 12 chip; grey = plain quantity, pink only for work waiting on the owner; filter tabs show grey 0), `type-scale-14-12.md` (no 13), `surfacecard-zones-api.md` (secondary/filter tabs).
Grammar: `Tabs kind="filter" items=[{ id, label, count, isAttention }] moreLabel inset="none"` (`branch/Tabs/index.d.ts` `TabItem.isAttention`). Code: `composites/InboxLeadList/index.tsx` (`TabsBand`), items from `modules/inbox/rows.ts` (`listViewOf`).

## Customers pane: search and three icon filters
Vì sao: CHƯA RÕ — one row: a SearchField (magnifier, placeholder "Tên, số điện thoại, đơn") then three outlined round icon buttons that each open a single-choice menu: channel (chat glyph), agent (chip glyph), sort (funnel glyph); a button is "active" when a choice other than all is made. The three glyph-only buttons carry their meaning only in aria labels (the "chip" glyph for agents and the "funnel" for sort say nothing to a sighted user) and on the phone the placeholder is cut ("Tên, số điện thoại,"). No owner law covers icon-only filter menus; an alternative is a `Select appearance="pill"` per filter showing the current choice.
Luật: `surfacecard-zones-api.md` (filter and search zones; on mobile the search becomes an icon), `suggestion-button-sm.md` (a Cluster of neutral sm pills), `type-scale-14-12.md`.
Grammar: `SearchField` (`leaf/SearchField/index.d.ts`), `DropdownMenu` + `IconButton isActive` (`branch/DropdownMenu`, `leaf/IconButton`); alternative `Select appearance="pill"` (`branch/Select/index.d.ts`) or `FilterButtonGroup` (`composite/FilterButtonGroup`). Code: `composites/InboxLeadList/index.tsx` (`ToolbarBand`, `FilterMenu`).

## Customers pane: rows under "Hôm nay" / "Hôm qua"
Vì sao: rows grouped by day under 12 muted section labels; a row = the customer avatar (Sprout fallback) with a channel badge (W web, Z Zalo, FB Facebook), the name 14/500, the time 12 at the end, two lines of what they want (12 muted), then 1-2 state chips, and at the end the mark of the agent that owns them. Selected row is a grey fill. State chips: "Cần bạn" and "Khách mới" are pink (owner work, new), "Chờ trả tiền" amber, "Đang tư vấn" grey. The agent mark (red Sales avatar) repeats on every row because one agent owns all customers; it adds no information in that case.
Luật: `table-heroui-native-section-head.md` (pink only for what waits for the owner), `type-scale-14-12.md`, `page-header-left-sublabel-xs.md` (Sprout avatar fallback).
Grammar: `ListBox sections items { leading, meta, footer, trailing }` (`branch/ListBox/index.d.ts`), `Badge tone` (`leaf/Badge`); app `ChannelAvatar`, `AgentMark`. Code: `composites/InboxLeadList/index.tsx` (`itemOf`).

## Head card of the opened customer (avatar, name, stage chip, source line, ⋯, assign, "Nhắn khách", stepper)
Vì sao: the first card of the pink well: avatar with channel badge, name 14 bold with the stage chip ("Khách mới"), a 12 muted source line, an overflow menu (copy phone); under it a pill `Select` "Giao cho Sales" (the muted word "Giao cho" is the prefix, so it reads as an action) and the one primary command "Nhắn khách" (`commit`, `sm`, no icon), then a 5-step `Stepper` (Mới vào, Đang tư vấn, Đã đặt đơn, Đã trả tiền, Xong) with the current step filled. Stage chips and the stepper say the same thing twice (stage chip "Khách mới" and step 1 "Mới vào"); the stepper is the real state, the chip is redundant. A phone adds the back arrow before the Select.
Luật: `page-header-left-sublabel-xs.md` (sm buttons: no icon, even primary), `suggestion-button-sm.md`, `pink-page-surface-rule.md` (separate floating white block per job).
Grammar: `SurfaceCard` + `Select appearance="pill" prefix` (`branch/Select/index.d.ts`) + `Button intent="commit" size="sm"` + `Stepper steps currentStepId` (`composite/Stepper/index.d.ts`) + `DropdownMenu`. Code: `composites/InboxLeadHead/index.tsx`.

## Approval card ("Việc cần bạn" 1: Sales chờ bạn duyệt)
Vì sao: SAI — the card asks the owner to approve an order the agent drafted: a warning `Alert` (title "Sales chờ bạn duyệt: tạo đơn DH-…", the line "Bó hồng mini × 2 · 2.000 ₫ / bó · 4.000 ₫"), then three actions: "Duyệt tạo đơn" (commit), "Sửa đơn →" (alternative), "Từ chối" (neutral). Defect: the count "1" is passed as `fact="1"`, which Grammar draws as a plain right-aligned number far from its label; the law puts a count in a 12px chip right after the label, pink here because it is owner work. The action trio is the right set (one primary, one navigation, one quiet).
Luật: `table-heroui-native-section-head.md` (label + count chip left; pink for waiting work), `page-header-left-sublabel-xs.md`, `blocks-are-real-code.md` (data changes via actions: approve/reject).
Grammar: `SurfaceCard label fact` (`frame/SurfaceCard/index.d.ts`; should be `Section count isAttention`), `Alert tone="cautionary"` (`composite/Alert`), `Button intent="commit"|"alternative"|"neutral"`. Code: `composites/InboxApprovalCard/index.tsx`.

## "Khách cần gì" card (AI tóm tắt, summary, Món / Giá trị / Giao / Ghi chú)
Vì sao: SAI — one card holding three contents: a muted hint line ("Tổng hợp từ form, tin nhắn và bảng giá trong Second Brain."), a paragraph (the AI summary) and a divided description list of four facts. Law: ONE CONTENT PER CARD and a lone sentence is never a description under a label; the hint is a loose explanation and the summary paragraph should be the first row of the list (or its own card). Also the "AI tóm tắt" badge on the right of the head is pink-accent decoration: the pink chip is reserved for work waiting on the owner, an "AI" provenance mark should be neutral.
Luật: `table-heroui-native-section-head.md` (one content per card; descriptions out of the head; pink only for owner work), `surfacecard-select-subtitle.md` (a subtitle only directly under a title in the same row), `grammar-core-heroui.md`.
Grammar: `SurfaceCard label labelEnd` + `DescriptionList isDivided` (`frame/SurfaceCard/index.d.ts`, `composite/DescriptionList/index.d.ts`); `Badge tone="neutral"`. Code: `composites/InboxNeedsCard/index.tsx`.

## Journey card ("Hành trình", All | Tin nhắn | Agent, chat-style entries)
Vì sao: below the fold in the shot: the customer's whole path across channels drawn like the team chat (customer messages, shop replies, agent cards, milestones) with a day `Divider` per new day; the three-option switch in the card's header zone narrows it to the customer's messages or to the agents' work (`kind: "switch"`, a pill of 3 fixed views, allowed). Empty: a history icon notice inside the card.
Luật: `surfacecard-zones-api.md` (switch zone: pill = primary, 2-4 modes), `pink-page-surface-rule.md` (one block per job).
Grammar: `SurfaceCard label headers=[{ kind: "switch" }]` + `Divider label` + app `InboxJourneyEntry`. Code: `composites/InboxJourneyCard/index.tsx`.

## Aside pane ("Khách hàng", "Nguồn", "Đơn & thanh toán")
Vì sao: the customer's facts in a full-height white column with a left border (chrome, not cards): three sections, each a 14/500 `Section` title over a divided term/value `DescriptionList` (phone masked "84•• ••• 101", Zalo "chưa liên kết", Lần đầu, Đã mua; Kênh, Trang, Chiến dịch, Thiết bị), and the orders block that says "Chưa có đơn" with a 12 muted line when none; each order lists its number and value, what it holds, its status badge and, for the owner or a manager on a draft or confirmed order, the small danger-soft "Huỷ đơn" (see `huy-don`). Below the wide width this pane is a drawer opened from an icon in the head card. With no customer open the aside is not drawn at all.
Luật: `nivo-surface-layering.md` (white full-height aside with a left border), `pink-page-surface-rule.md` (aside items are sections and rows separated by dividers, never cards), `type-scale-14-12.md`, CTA-4 (`contexts/ui/composition.md`: destructive entry is danger-soft).
Grammar: `Pane area="aside" surface scroll collapse="drawer"` (`frame/PaneGrid/index.d.ts`), `Section title headingLevel` (`frame/Section/index.d.ts`), `DescriptionList isDivided`. Code: `composites/InboxAside/index.tsx`, pane in `components/blocks/InboxFeed/component.tsx` (`asidePane`).

## Empty main pane and empty/filtered list
Vì sao: with no customer open the well shows one frameless notice with an envelope icon ("pickTitle"/"pickBody") and the aside is absent; a filtered-out list shows a frameless "no match" notice with a search icon, a first-day list shows "emptyTitle" with a neutral → action to Kết nối; a failed detail shows a warning-icon notice. A skeleton keeps the three card shapes while the customer loads.
Luật: ui-laws "EmptyNotice on a pane is frameless", `table-heroui-native-section-head.md` (empty/loading/error states live inside the block).
Grammar: `EmptyNotice frame="frameless" message description iconSource actionLabel actionEndArrow` (`composite/EmptyNotice/index.d.ts`) via `PaneBlank`; `SurfaceCard isLoading` skeleton. Code: `components/blocks/InboxFeed/component.tsx` (`MainBody`, `DetailSkeleton`), `composites/InboxLeadList/index.tsx` (`EmptyRows`).

## Website form drawer
Vì sao: the "Gắn form website" header command opens a right drawer hosted by the main pane (a modal that takes no room), so the route stays one `Page` and one grid; it holds the form-embedding switches (chat, form, prices), the agent select and Save. Not shown open in the shots.
Luật: `surfacecard-select-subtitle.md` (switch rows: label+description left, switch right; flat fields on the surface), `blocks-are-real-code.md`.
Grammar: `Drawer` (`frame/Drawer/index.d.ts`), `Switch` (`leaf/Switch`), `Select`. Code: `frames/InboxWebsiteDrawer/index.tsx`.

## Phone layout (390)
Vì sao: the list alone, or the opened customer alone (`phone: "list" | "main"`, the way back stands in the head card); the pane grid is single-column; the facts aside is a drawer behind a profile icon; the band keeps the trail, title, summary and the two buttons stacked. In the shot the first row is selected on a phone, which a phone list should not show as an open state (nothing is open until pressed): CHƯA RÕ whether the selected fill is the stale selection or a hover state from the capture.
Luật: `pink-page-surface-rule.md` (below lg the aside folds), `surfacecard-zones-api.md` (on mobile the search becomes an icon; here it stays a full field).
Grammar: `PaneGrid areas={{ base }}` (`frame/PaneGrid/index.d.ts`), `Pane collapse="drawer"`. Code: `components/blocks/InboxFeed/component.tsx`.

## Top bar (workspace lockup, language, theme, account)
Vì sao: chrome on the white surface, separated from the page by a border only: the workspace lockup (logo, name, the viewer's role "Chủ sở hữu") opens the workspace menu at the start; at the end the round language button with its VI/EN dropdown, the sun/moon switch and the account avatar (DiceBear Sprout fallback, no initials). Nothing page-specific lives here.
Luật: `nivo-surface-layering.md` (white chrome), `pink-page-surface-rule.md` (tier 1 chrome), `locale-switch-round-dropdown.md` (VI/EN is the round dropdown button, never a pill), `page-header-left-sublabel-xs.md` (Sprout avatar default).
Grammar: `TopBar` (`composite/TopBar/index.d.ts`) via `WorkspaceShell header`; `DropdownMenu` (`branch/DropdownMenu`), `IconButton`, `Switch`, `AvatarButton` (`leaf/AvatarButton`); app block `ConsoleHeader` (`blocks/ConsoleHeader/component.tsx`).

## Sidebar (active: Đầu vào)
Vì sao: white rail, full height, a border on its edge: the daily-work group has no heading, "Điều hành" and "Thiết lập" are 12px muted sublabels; the open destination ("Đầu vào") is a soft-pink fill; the count chip is pink and sits only on Second Brain (73 items waiting for the owner), which is the one place the pink-means-waiting rule applies; a round « button at the top collapses it.
Luật: `nivo-surface-layering.md` (sidebar is chrome = surface), `type-scale-14-12.md` (14 items, 12 group labels), `table-heroui-native-section-head.md` (pink chip only for work waiting on the owner).
Grammar: `Sidebar` `groups` `items` `trailing` (`composite/Sidebar/index.d.ts`) through `WorkspaceShell navigation`; app composite `ConsoleSidebar` (`composites/ConsoleSidebar/index.tsx`) and block `ConsoleNavigation`.

## Phone: navigation opener row (390)
Vì sao: CHƯA RÕ — below the wide width the sidebar is a drawer and Grammar `WorkspaceShell navigationDrawer` draws its opener as the round "⋯" button alone in a full 64px row under the top bar, before the page header. The owner has not ruled on it; the admin app puts a hamburger inside the top bar (`TopBar menu`), and the "more" glyph reads as an overflow menu, not navigation.
Luật: `nivo-surface-layering.md` (below lg the chrome folds), no law names the opener.
Grammar: `WorkspaceShell` `navigationDrawer` (`frame/WorkspaceShell/index.d.ts`); `TopBar` `menu` (`composite/TopBar/index.d.ts`) is the in-bar alternative.

## Floating NIVO AI button
Vì sao: CHƯA RÕ — the round NIVO AI face is the entry to the assistant drawer, fixed bottom right above the content. It overlaps the lower right of the last customer rows (390) and of the detail well (1440); no owner law says where it may sit or that the page needs bottom clearance.
Luật: `suggestion-button-sm.md` (names the assistant drawer), no placement law.
Grammar: `AvatarButton size="floating"` (`leaf/AvatarButton/index.d.ts`) in app block `GuideBubble` (`blocks/GuideBubble/component.tsx`).
