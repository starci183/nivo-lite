---
title: Admin / Workspace (lọc "Cần chú ý")
route: /?filter=attention
area: admin
---
Route: `/?filter=attention` (admin app). The same list with the "Cần chú ý 2" filter selected.

Grammar paths are under `node_modules/@starci/grammar/dist/core/`. This is the team console (`fe/apps/admin`, its own `WorkspaceShell` with a top bar and no sidebar), not the customer console. The round "N" and "1 Issue" are Next dev overlays, not app UI. Admin is staff-only, so its copy is not in the owner's design canvas; laws are the Grammar and surface laws that apply to every page.

## Header band offset (a 64px pink strip under the top bar)
Vì sao: SAI — a 64px pink strip separates the top bar from the header band (band at y=128, not 64), and the first row of the body is hidden behind the band (the first card labels / the filter tabs are cut). Same sticky-offset defect as the customer console shots: the band sticks 64px too low and content scrolls behind a gap.
Luật: `pink-page-surface-rule.md` (the band is chrome on the white surface and never scrolls away), `nivo-surface-layering.md`.
Grammar: `Page` header band sticky offset (`frame/Page/index.d.ts`, `composite/PageHeader`); shell var in `WorkspaceShell` (`frame/WorkspaceShell/index.d.ts`). Fix in Grammar.

## Page width (measure "full")
Vì sao: SAI — the admin pages use `Page measure="full"`, so content runs edge to edge at 1440 (and further at 1920), 32px from each side. The law caps card content in the pink well at `--grammar-content-max` (80rem) and centres it; only chat, graph and editor panes are full-bleed, and a table card is not one of them. Should be `measure="product"`.
Luật: `page-header-left-sublabel-xs.md` (content inside the pink well: capped at 80rem and centred), `table-heroui-native-section-head.md` (Scroll: 80rem cap only for card panes).
Grammar: `Page measure` (`frame/Page/index.d.ts`, `PageMeasure`). Code: `fe/apps/admin/src/components/blocks/AdminWorkspaces/component.tsx`, `AdminHealth`, `AdminWorkspaceScreen` (all `measure="full"`).

## Selected filter "Cần chú ý 2" shows all 6 rows
Vì sao: SAI — with "Cần chú ý" selected (underline on it) the table still lists 6 workspaces, four of which have no "Cần chú ý" chip (Spa Lá Xanh, Cửa hàng Mộc Mạc, Studio Ánh Dương and the second "Tiệm hoa Bình An"), and the footer still says "Đang hiện 6 trên 6". The tab count says 2. Either the filter is not applied to the rows in this capture or the filter and the badge use different predicates; the rows must match the count.
Luật: `table-heroui-native-section-head.md` (filter tabs and counts must agree with the list), `blocks-are-real-code.md` (state lives in the URL params plus SWR reads).
Grammar: `SurfaceCard kind="table" headers=[{ kind: "filter", selectedKey }]` (`frame/SurfaceCard/index.d.ts`). Code: `fe/apps/admin/src/components/blocks/AdminWorkspaces/component.tsx` (`props.props.filter`, `rows`) and the page read in `AdminWorkspacesPage`.

## Header band (title "6 doanh nghiệp khách hàng", description)
Vì sao: the band has the title with the live count of customers ("6 doanh nghiệp khách hàng") and a 14 muted sentence ("Thanh toán, trợ lý, kết nối và hoạt động của từng workspace."), no trail (root). The count in the title is the one place the number is spelled out; the table footer says it again ("Đang hiện 6 trên 6").
Luật: `page-header-left-sublabel-xs.md`, `type-scale-14-12.md`.
Grammar: `Page header={{ breadcrumbs: "root", title, description }}` (`frame/Page/index.d.ts`). Code: `fe/apps/admin/src/components/blocks/AdminWorkspaces/component.tsx`.

## Filter tabs (Tất cả 6, Cần chú ý 2, Chưa thanh toán 1, Không hoạt động 7 ngày 1)
Vì sao: SAI — a filter zone of tabs with 12px count chips, the rest folding into "+n" on narrow widths. The "Cần chú ý 2" and "Chưa thanh toán 1" counts are work waiting for the team, so their chips must be pink (`isAttention`); the code passes only `count`, so everything is grey. The catalogue page does it right.
Luật: `table-heroui-native-section-head.md` (tab counts: grey plain, pink only for work waiting), `surfacecard-zones-api.md` (filter zone; extra tabs fold on mobile).
Grammar: `SurfaceCard kind="table" headers=[{ kind: "filter", items[{ count, isAttention }] }]` (`frame/SurfaceCard/index.d.ts`), `Tabs kind="filter"` (`branch/Tabs/index.d.ts`). Code: `fe/apps/admin/src/components/blocks/AdminWorkspaces/component.tsx` (`Results`).

## Search field
Vì sao: one full-width search zone under the tabs ("Tên, email chủ sở hữu hoặc mã") with the magnifier and a clear button; it filters the rows by name, owner e-mail or code.
Luật: `surfacecard-zones-api.md` (search zone), `pink-page-surface-rule.md` (a block's own filters and search live in its header).
Grammar: `SurfaceCard headers=[{ kind: "search" }]` (`frame/SurfaceCard/index.d.ts`), `SearchField` (`leaf/SearchField`). Code: `fe/apps/admin/src/components/blocks/AdminWorkspaces/component.tsx`.

## Workspaces table (9 columns, grey frame, white body)
Vì sao: the HeroUI-native table card: grey frame with the column heads inside the grey, a white rounded body, shadow, no border; the row opens the workspace (`href`); `priority: "low"` columns drop on the phone. The columns: Workspace (name + "Cần chú ý" warning chip), Chủ sở hữu, Thanh toán (status dot chip + "đến 20 thg 10, 2026" 12 muted), Gói, Trợ lý (badges), Kết nối (badges), Tin khách gần nhất, Tin 7 ngày (right aligned), Đang chờ (pink chip when > 0, plain "0" otherwise). Defects: (1) the table is the content of one card (correct) but its width runs full bleed (see page width); (2) all 9 columns are visible at 1440 and the Kết nối and Trợ lý cells wrap to three lines of chips, making rows 60-70px tall; (3) the first and the last row are both "Tiệm hoa Bình An" with different owners (seed data).
Luật: `table-heroui-native-section-head.md` (tables = HeroUI native; the frame IS the card; Table column API width/priority/hideBelow; phone = list of rows), `type-scale-14-12.md`.
Grammar: `SurfaceCard kind="table" columns[{ priority, align }] rows[{ href, cells }]` (`frame/SurfaceCard/index.d.ts`), `DataTable` (`branch/DataTable/index.d.ts`), `Badge`, `Text`. Code: `fe/apps/admin/src/components/blocks/AdminWorkspaces/component.tsx` (`rowOf`, `renderWorkspaceCell`).

## Raw badge words in Trợ lý and Kết nối cells
Vì sao: SAI — the Trợ lý cells print "Chatbot: live", "Sales: live", "sales: setup" and the Kết nối cells "zalo × 1", "telegram × 1", "zalo: 1 lỗi", "telegram: 1 im lặng": agent names are capitalised in one badge and lower-case in the next ("Sales: live" vs "sales: setup"), the states "live" and "setup" are English enum values, and the provider keys are raw lower-case ids. They should be Vietnamese labels with proper names ("Sales · Đang chạy", "Zalo × 1", "Zalo · 1 lỗi").
Luật: `type-scale-14-12.md`, `blocks-are-real-code.md` (renderers are presentation only: labels come from the read).
Grammar: `Badge tone` (`leaf/Badge/index.d.ts`) through `fe/apps/admin/src/components/leaves/AdminBadges/index.tsx`; label builders in the admin read hooks.

## Table footer ("Đang hiện 6 trên 6 · bấm tên để xem tổng quan đầy đủ.")
Vì sao: SAI — the footer is a `custom` footer zone holding a `Text size="sm"` line. The table law gives the grey pagination footer ("1–6 trong 6", ‹ Trước 1 2 Sau ›); a hand-written count and a usage hint ("bấm tên để xem…") belong to `paging` and a header-less caption, and the hint is a loose explanation. Should be `footers=[{ kind: "paging" }]`.
Luật: `table-heroui-native-section-head.md` (grey pagination footer: "1–3 trong 8", ‹ Trước 1 2 Sau ›), `surfacecard-zones-api.md` (footer kinds more/paging/custom).
Grammar: `SurfaceCard footers=[{ kind: "paging" }]` (`frame/SurfaceCard/index.d.ts`), `Pagination` (`composite/Pagination/index.d.ts`). Code: `fe/apps/admin/src/components/blocks/AdminWorkspaces/component.tsx` (`footers`).

## Empty, loading, error
Vì sao: a filter or search that keeps none shows an `EmptyNotice` with the "clear" action; the first read draws the same table as skeleton rows; a failure draws the soft retry band. Not visible in the shots.
Luật: `pink-page-surface-rule.md`.
Grammar: `EmptyNotice actionLabel onAction`, `SlotView` (`composite/EmptyNotice/index.d.ts`). Code: `fe/apps/admin/src/components/blocks/AdminWorkspaces/component.tsx`.

## Phone layout (390)
Vì sao: the table becomes a list of rows: each row is the name + "Cần chú ý" chip, then labelled lines (Chủ sở hữu, Gói, Trợ lý, Kết nối, Tin khách gần nhất, Tin 7 ngày, Đang chờ) with the billing badge floating at the right of the first lines; the column header row "Workspace | Thanh toán" stays above although the rows are no longer columns. The labelled lines make each row ~240px, so three customers fill the screen.
Luật: `table-heroui-native-section-head.md` (phone = list of rows; `hideBelow` columns).
Grammar: `SurfaceCard kind="table"` column `priority` (`frame/SurfaceCard/index.d.ts`). Code: `fe/apps/admin/src/components/blocks/AdminWorkspaces/component.tsx`.

## Top bar (title, destinations, language, theme, account)
Vì sao: CHƯA RÕ — the white bar carries the product name "Bảng điều khiển đội NIVO" (bold text), then the destinations "Workspace" and "Sức khỏe nền tảng" as `sm` pills (the open one is `alternative`, the other `neutral`), and at the end the round language dropdown, the sun/moon switch and the account avatar menu with the e-mail and sign out. The language, theme and account controls follow the locale-switch rule. No owner law says destinations of a console are `sm` pill buttons in the bar rather than tabs or a sidebar; the customer console uses a sidebar and header tabs. The first destination also reads like part of the title.
Luật: `locale-switch-round-dropdown.md` (round dropdown, never a pill), `nivo-surface-layering.md` (top bar is white chrome), `page-header-left-sublabel-xs.md` (sm buttons carry no icon).
Grammar: `TopBar brand navigation actions menu` (`composite/TopBar/index.d.ts`), `NavLandmark layout="bar"`, `Button size="sm"`, `DropdownMenu`, `Switch`, `AvatarButton` (`frame/NavLandmark`, `leaf/Button`, `branch/DropdownMenu`, `leaf/Switch`, `leaf/AvatarButton`). Code: `fe/apps/admin/src/components/blocks/AdminHeader/component.tsx`.

## Phone: top bar (390)
Vì sao: SAI — the bar spends the width on the hamburger, the language button, the theme switch and the avatar, leaving the product name cut to "Bảng điều khiển đ…". The destinations move to the left drawer (correct, the hamburger is in the bar, unlike the customer console). The brand should keep its full text (or shrink to a short mark) and the language/theme controls should move into the drawer.
Luật: `type-scale-14-12.md`, `page-header-left-sublabel-xs.md`.
Grammar: `TopBar menu={{ visibility: "compact" }}` with `Drawer placement="left"` (`composite/TopBar/index.d.ts`, `frame/Drawer/index.d.ts`). Code: `fe/apps/admin/src/components/blocks/AdminHeader/component.tsx`.
