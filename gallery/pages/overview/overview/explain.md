---
title: Tổng quan
route: /workspaces/<ws>/overview
area: overview
---
Route: `/workspaces/<ws>/overview`. The owner's home: how the business did and what the agents did. A report page (`chrome="standard"`, the pink well, cards in one column). Shots `1440.png`, `1920.png`, `390.png` are the newest set (this folder; `tong-quan`, `tong-quan-cuoi` and `overview-list` are older copies); the 390 shot is one screen tall, so the lower regions are described from the code order (`regions.tsx`).

Grammar paths are under `node_modules/@starci/grammar/dist/core/`. Screens are the console shell (`ConsoleLayout`, a `WorkspaceShell`) around one route page. Shots are taken in the Next dev server (the round "N" button, "Compiling" and "1 Issue" pills are Next dev overlays, not app UI; retake with `devIndicators: false`).

## Header band (title, description, period switch, report button)
Vì sao: the white band holds the title "Tổng quan" (18), a one-line 14 muted description with the date range, and at the end the period switch and "Xuất báo cáo". No trail because the page is the root. The period switch is a pill `Tabs appearance="primary"` of exactly 4 fixed options that switches the same data (a period), the one case the pill is allowed; the report button is a neutral `md` button. On a phone the description wraps to two lines, the pill switch takes the full width and the report button drops below it.
Luật: `page-header-left-sublabel-xs.md` (band flush left), `surfacecard-zones-api.md` (pill = primary tabs for 2-4 mode/period switch; no segmented ButtonGroup), `type-scale-14-12.md`.
Grammar: `Page measure="product" header={{ breadcrumbs: "root", title, description, actions }}` (`frame/Page/index.d.ts`); `Tabs appearance="primary"` (`branch/Tabs/index.d.ts`, `PrimaryTabItem`); `Button intent="neutral"`. Code: `components/blocks/OverviewDashboard/component.tsx` (`headerActions`).

## Key figures ribbon (Doanh thu, Đơn hàng, Khách mới, Tỉ lệ chốt, Agent tự làm)
Vì sao: SAI — one card of five figures, each a 14 muted term, a 20 value and a 12 delta ("▲ 6 đơn so với 7 ngày trước"): the structure is right (one figures ribbon, value never breaks inside a number; phone wraps to 2 columns then 1). Two defects: the revenue is "2k" with no currency while the channels table below prints "2.000 ₫" (the same money in two formats; should be "2.000 ₫"), and three of five deltas read "Chưa có kỳ trước so với 7 ngày trước" ("no previous period compared with the previous 7 days"), a self-contradicting sentence; should be "Chưa có dữ liệu kỳ trước" or hidden.
Luật: `surfacecard-zones-api.md` (figures zone wraps 2x2 or one column, never breaks a number), `type-scale-14-12.md` (20 is a display size), `table-heroui-native-section-head.md` (one content per card: a figures ribbon).
Grammar: `SurfaceCard kind="figures" items=[{ term, value, meta }]` (`frame/SurfaceCard/index.d.ts`); code `composites/OverviewKpiCard/index.tsx`, formatting in `modules/overview/money.ts` and `change.ts`.

## Chart card ("Doanh thu theo ngày" + note, Doanh thu | Đơn switch, bars)
Vì sao: SAI — the card is a `BarChart` of the days of the period with a pill switch (Doanh thu | Đơn, same data two measures, allowed as a 2-option pill) in the card's own header zone. But the section head carries a description: "Doanh thu theo ngày  Đã nhận tiền, đối chiếu qua SePay" is drawn inline after the label, from `SurfaceCard fact={note}`. The law says no description beside or under a section label; it must become a 12 muted caption under the card (as the channels and agents tables already do with `Section caption`). Also the head is vertically misaligned with the funnel head beside it (y 388 vs 376), and days with 0 still draw a red baseline stub.
Luật: `table-heroui-native-section-head.md` (head = label + count chip left, one link or ⓘ right, NO description; descriptions become a 12 caption under the card), `surfacecard-zones-api.md` (switch zone), `type-scale-14-12.md`.
Grammar: `SurfaceCard label fact headers=[{ kind: "switch" }]` (`frame/SurfaceCard/index.d.ts`) + `BarChart bars` (`composite/BarChart/index.d.ts`); should be `Section caption` around a card as in `composites/OverviewChannelsCard/index.tsx`. Code: `composites/OverviewRevenueCard/index.tsx`.

## Funnel card ("Phễu bán hàng" + sub-line, four meters)
Vì sao: SAI — four `Meter`s (Khách vào 9 · 100%, Được tư vấn, Đặt đơn, Đã trả tiền) each against those who came in, in one card: right content (one list of same-kind steps). But "Từ khách vào tới đã trả tiền" sits under the title as a 14 muted line (`SurfaceCard fact={note}`), the same description-under-label violation as the chart; should be a caption under the card. The bar fill is the accent red though the meters are `tone="neutral"`; if red is intended it needs a tone, else it should be grey.
Luật: `table-heroui-native-section-head.md` (no description under a label), `owner-colors-exact.md` (accent = exact primary, do not swap), `grammar-core-heroui.md` (tones from HeroUI).
Grammar: `SurfaceCard label fact` + `Meter` (`leaf/Meter/index.d.ts`) in `composites/OverviewFunnelCard/index.tsx`; layout `Grid kind="main-rail" railWidth="medium"` (`frame/Grid/index.d.ts`) in `blocks/OverviewDashboard/regions.tsx`.

## Channels table ("Kênh mang khách" + "Mở Đầu vào →")
Vì sao: the head is label left, one navigation link "Mở Đầu vào →" right (arrow slides on hover), the caption "Số khách và doanh thu theo kênh" is a 12 muted line under the card: exactly the section-head law. The body is a native HeroUI table (grey frame, white rounded body, shadow, no border) with three columns; the channel cell carries a small `Meter` under the name (share of customers). Columned data is a Table, not a hand-rolled list, as the law requires. With only 4 rows the grey pagination footer is absent, which is fine under 5 rows; the in-cell meter is Grammar `Meter size="sm"`.
Luật: `table-heroui-native-section-head.md` (tables = HeroUI native; section head; "Xem tất cả ở Đầu vào" moves to the head), `type-scale-14-12.md`.
Grammar: `Section title caption action={<Link variant="head">}` (`frame/Section/index.d.ts`) + `DataTable columns rows renderCell` (`branch/DataTable/index.d.ts`) + `Meter size="sm"`. Code: `composites/OverviewChannelsCard/index.tsx`.

## Việc cần bạn ("Việc cần bạn 23" + "Xem tất cả →", approval rows)
Vì sao: what waits for the owner across agents: head = label + count chip 23 in pink (pink only for work waiting on the owner) left, one "Xem tất cả →" link right; the body is one list card with a row per item (review icon tile, title, "agent · 2 ngày trước", chevron) that opens the item in its agent's workbench. The card shows the oldest 6 and the link carries the rest. The five identical rows "AI gặp lỗi xử lý tin – cần xem" are seed data, not a layout fault; the card is the tallest in its row (it sets the row height, leaving the channels and savings columns half empty) because `height="fill"` stretches only the shorter ones.
Luật: `table-heroui-native-section-head.md` (count chip pink for waiting work; link right), `pink-page-surface-rule.md` (one block per job).
Grammar: `Section count isAttention action` + `SurfaceCard kind="list" items height="fill"` (`frame/Section`, `frame/SurfaceCard`); code `composites/OverviewApprovalsCard/index.tsx`; layout `Grid kind="featured"` (`frame/Grid/index.d.ts`).

## Agent làm thay bạn (ⓘ, description list)
Vì sao: SAI — the head is label left and one ⓘ tooltip right (how the hours are counted), correct. The card is a divided `DescriptionList layout="columns"`: hours saved, messages answered, orders created, payments matched, credits used. Defect: the first row's term is lower-case and a sentence fragment ("agent làm thay bạn trong kỳ này", from `hoursNote`) while the other four are Capitalised nouns; the term should be the noun "Giờ tiết kiệm" with the period in the card, not the head of a sentence.
Luật: `table-heroui-native-section-head.md` (ⓘ on the right of the head), `surfacecard-select-subtitle.md` (row titles are short nouns), `type-scale-14-12.md`.
Grammar: `Section action={<Tooltip><IconButton info/></Tooltip>}` + `SurfaceCard` + `DescriptionList layout="columns" isDivided` (`composite/DescriptionList/index.d.ts`, `branch/Tooltip`). Code: `composites/OverviewSavingsCard/index.tsx`.

## Hiệu suất agent table ("Mở Agent →", 8 columns)
Vì sao: SAI — head and caption are right (link "Mở Agent →" right, 12 caption under the card) and the table is the HeroUI native frame with the avatar + name + "@handle" in the first column, numbers aligned right, `priority: "low"` columns hidden on the phone. Defect: the "Tự làm" column draws only a bar (every row the same length) with no number, because the code passes `isLabelHidden` to the `Meter` and Grammar hides the reading together with the label (`MeterProps.isLabelHidden`), so `valueLabel` never shows; the share is the whole point of the column. Should show the percent text with the bar (or a number only). "Chờ bạn" is a pink/warning chip, "Lỗi" a danger chip when > 0, grey when 0: the law is respected.
Luật: `table-heroui-native-section-head.md` (columned data = Table; Table column API `priority`/`hideBelow`; phone = list of rows), `type-scale-14-12.md`.
Grammar: `Section caption action` + `DataTable columns[{ isNumeric, priority }]` + `Meter size="sm" valueLabel` + `Badge tone` (`branch/DataTable/index.d.ts`, `leaf/Meter/index.d.ts`, `leaf/Badge`). Code: `composites/OverviewAgentsCard/index.tsx`.

## Loading, forbidden and error states
Vì sao: the first read draws the same regions as skeletons (`placeholder` view of the same shape, `isLoading` on every card, so nothing jumps); a failure draws the soft retry band (`errorLayout="band"`); a staff member who may not see takings gets one notice with a neutral "Mở Agent →" button instead of the figures (`forbidden="notice"`). Not visible in the shots (none shows them); described from `OverviewDashboardBase`.
Luật: `table-heroui-native-section-head.md` (empty/loading/error live inside the block), ui-laws "EmptyNotice on a pane is frameless".
Grammar: `SlotView` (`@nivo-lite/agent-sdk/client`) `placeholder` `forbidden` `errorLayout="band"`; `EmptyNotice`, `Button endArrow` (`composite/EmptyNotice`, `leaf/Button`). Code: `components/blocks/OverviewDashboard/component.tsx`.

## Phone layout (390)
Vì sao: the order changes on a phone: key figures, then "Việc cần bạn" first (what needs the owner outranks the charts), then chart, funnel, channels, savings, agents, all in one column (`isPhone` branch of `OverviewRegions`); figures wrap to a 2-column grid; tables drop their `priority: "low"` columns. The band is not sticky-collapsed; the period pill spans the width. In the shot the floating button covers the "Xem tất cả" link of the second block.
Luật: `pink-page-surface-rule.md` (below lg, the aside becomes the first block), `surfacecard-zones-api.md` (figures wrap 2x2).
Grammar: `Stack gap="section"` and `Grid` kinds in `blocks/OverviewDashboard/regions.tsx`; `SurfaceCard kind="figures"`.

## Top bar (workspace lockup, language, theme, account)
Vì sao: chrome on the white surface, separated from the page by a border only: the workspace lockup (logo, name, the viewer's role "Chủ sở hữu") opens the workspace menu at the start; at the end the round language button with its VI/EN dropdown, the sun/moon switch and the account avatar (DiceBear Sprout fallback, no initials). Nothing page-specific lives here.
Luật: `nivo-surface-layering.md` (white chrome), `pink-page-surface-rule.md` (tier 1 chrome), `locale-switch-round-dropdown.md` (VI/EN is the round dropdown button, never a pill), `page-header-left-sublabel-xs.md` (Sprout avatar default).
Grammar: `TopBar` (`composite/TopBar/index.d.ts`) via `WorkspaceShell header`; `DropdownMenu` (`branch/DropdownMenu`), `IconButton`, `Switch`, `AvatarButton` (`leaf/AvatarButton`); app block `ConsoleHeader` (`blocks/ConsoleHeader/component.tsx`).

## Sidebar (active: Tổng quan)
Vì sao: white rail, full height, a border on its edge: the daily-work group has no heading, "Điều hành" and "Thiết lập" are 12px muted sublabels; the open destination ("Tổng quan") is a soft-pink fill; the count chip is pink and sits only on Second Brain (73 items waiting for the owner), which is the one place the pink-means-waiting rule applies; a round « button at the top collapses it.
Luật: `nivo-surface-layering.md` (sidebar is chrome = surface), `type-scale-14-12.md` (14 items, 12 group labels), `table-heroui-native-section-head.md` (pink chip only for work waiting on the owner).
Grammar: `Sidebar` `groups` `items` `trailing` (`composite/Sidebar/index.d.ts`) through `WorkspaceShell navigation`; app composite `ConsoleSidebar` (`composites/ConsoleSidebar/index.tsx`) and block `ConsoleNavigation`.

## Phone: navigation opener row (390)
Vì sao: CHƯA RÕ — below the wide width the sidebar is a drawer and Grammar `WorkspaceShell navigationDrawer` draws its opener as the round "⋯" button alone in a full 64px row under the top bar, before the page header. The owner has not ruled on it; the admin app puts a hamburger inside the top bar (`TopBar menu`), and the "more" glyph reads as an overflow menu, not navigation.
Luật: `nivo-surface-layering.md` (below lg the chrome folds), no law names the opener.
Grammar: `WorkspaceShell` `navigationDrawer` (`frame/WorkspaceShell/index.d.ts`); `TopBar` `menu` (`composite/TopBar/index.d.ts`) is the in-bar alternative.

## Floating NIVO AI button
Vì sao: CHƯA RÕ — the round NIVO AI face is the entry to the assistant drawer, fixed bottom right above the content. It overlaps the "Xem tất cả" link of "Việc cần bạn" on a phone (390) and the bottom of the page on desktop; no owner law says where it may sit or that the page needs bottom clearance.
Luật: `suggestion-button-sm.md` (names the assistant drawer), no placement law.
Grammar: `AvatarButton size="floating"` (`leaf/AvatarButton/index.d.ts`) in app block `GuideBubble` (`blocks/GuideBubble/component.tsx`).
