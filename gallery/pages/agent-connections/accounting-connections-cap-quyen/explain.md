---
title: Kết nối (Kế toán), ngăn kéo cấp quyền
route: /workspaces/<ws>/agents/<module>/<installation>/connections
area: agent-connections
---
Route `/workspaces/<ws>/agents/<module>/<installation>/connections`. Block `AgentConnections` draws one well of cards: the channels the agent uses, one choice card per granted account with the three access levels, and the accounts not granted yet. The old aside and the provider tables are gone. The shot has the grant drawer open on the account that is not granted.

Grammar paths are under `node_modules/@starci/grammar/dist/core/`. Shots: `1440.png`, `1920.png`, `390.png`, taken in the Next dev server (the round N button and the Compiling pill are Next dev overlays, not app UI).

## Dải đầu trang (đường dẫn, tên agent, trạng thái, tab)
Vì sao: the white header band never scrolls: trail, agent mark and name with the status chip, one tab row (Bàn làm việc, Công việc, Graph, Quy trình, Trò chuyện, Kết nối, Tri thức, Thiết lập) with 12px count chips (grey for the grants on Kết nối, pink for the 73 facts that wait for the owner). It is the `AgentInstanceFrame` band shared by every agent tab and owned by the agent-frame lane, not by this page; the 20px left offset on chat tabs against the 40px of card tabs (`hasPanes` drops the gutter) and the raw ">" tab overflow button at 390 are tracked there.
Luật: `page-header-left-sublabel-xs` (band flush left), `table-heroui-native-section-head` (tab counts are chips; header band never scrolls).
Grammar: `Page` `header` with `tabs` and `breadcrumbs` (`frame/Page/index.d.ts`, `frame/PageHeader/index.d.ts`); app block `AgentInstanceFrame`.

## Khối "Kênh agent dùng" (nhãn, chip đếm, "Thêm kênh →")
Vì sao: a list card of the granted accounts: the label with a grey count chip at the start and one head link "Thêm kênh →" (to the shop Connections page) at the end. No loose caption under the card; what is not granted is a card of its own below.
Luật: `table-heroui-native-section-head` (section head: label and count left, one link right, no description), `surfacecard-select-subtitle` (no loose explanatory lines).
Grammar: `Section kind="list"` `count` `action={<Link variant="head">}` (`frame/Section`, `leaf/Link/index.d.ts`).

## Hàng kênh (logo, tên ↗, "Đã kết nối", menu ⋯)
Vì sao: a row is the provider logo, the brand as a link to the connection page, the account line, a status badge with a dot and a "more" menu. Taking the grant back ("Thu hồi quyền") is destructive, so it lives in the row menu as a danger item and asks a confirm dialog ("Thu hồi quyền của Kế toán?") before it runs.
Luật: `surfacecard-select-subtitle` and `table-heroui-native-section-head` (destructive commands are never a visible button at rest).
Grammar: `ListRowData` `menu` with `DropdownMenuEntry tone="danger"` (`surfaceCardData.d.ts`, `branch/DropdownMenu/index.d.ts`), `AlertDialog` (`frame/AlertDialog/index.d.ts`).

## Khối quyền của từng tài khoản (Chỉ đọc / Hỏi trước / Tự làm)
Vì sao: the grant is a three-level model, so each granted account is a choice card named after the account: three checkbox rows with a title and a one-line subtitle (what the level means), one checked, saved at once. A two-state switch would hide the middle level, so none is used.
Luật: `surfacecard-select-subtitle` (every choice list is `SurfaceCard kind="select"`, checkbox look even for one choice; a subtitle sits only under a title).
Grammar: `SurfaceCard kind="select" selectionMode="single"` (`frame/SurfaceCard/index.d.ts`, `surfaceCardData.d.ts` `SelectData`).

## Khối "Chưa cấp cho agent" (tên, "Cấp quyền")
Vì sao: the accounts of the shop the agent holds no grant on, each with one neutral small pill "Cấp quyền" that opens the three-step grant drawer. It exists only when there is such an account.
Luật: `page-header-left-sublabel-xs` (sm buttons have no icon), `table-heroui-native-section-head`.
Grammar: `Section kind="list"` with row `action` (`surfaceCardData.d.ts` `ItemAction`).

## Ngăn kéo "Cấp quyền cho Kế toán" (3 bước)
Vì sao: a right drawer in three steps: the account, what it is for, the access level, then a summary and the footer Huỷ / Cấp quyền (the one primary). The level step still draws radio rows; converting it to the checkbox choice card is queued with the drawer composite `AgentConnectionGrantDrawer` (gap listed in the report).
Luật: `surfacecard-select-subtitle`, `nivo-surface-layering` (overlay on the surface).
Grammar: `Drawer` (`frame/Drawer/index.d.ts`); app composite `AgentConnectionGrantDrawer`.

## Nút NIVO AI nổi
Vì sao: the round assistant button sits bottom right. On pages with a composer the guide block (`GuideBubble`, owned by the guide lane) lifts it above the composer and steps it aside while a text field has focus, so it no longer covers the field; it is the one floating control of the app.
Luật: `suggestion-button-sm` (the assistant entry), `blocks-are-real-code`.
Grammar: `AvatarButton size="floating"` (`leaf/AvatarButton/index.d.ts`) in app block `GuideBubble`.

## Thanh trên và thanh bên
Vì sao: the console shell chrome on the white surface: workspace lockup, round language dropdown, sun/moon switch, account avatar; the sidebar with the open destination in soft pink and the one pink count chip (Second Brain, work waiting for the owner). Nothing page-specific; the round N button and the pills at the foot are Next dev overlays.
Luật: `nivo-surface-layering` (chrome is white), `locale-switch-round-dropdown`, `table-heroui-native-section-head` (pink chip only for work waiting on the owner).
Grammar: `WorkspaceShell` `header` and `navigation` (`frame/WorkspaceShell/index.d.ts`); `TopBar`, `Sidebar` (`composite/TopBar`, `composite/Sidebar`); app blocks `ConsoleHeader`, `ConsoleNavigation`.

## Điện thoại 390: hàng mở thanh điều hướng
Vì sao: below the wide width the sidebar is a drawer; `WorkspaceShell` draws its opener as a round "more" button with the section name in a 64px row under the top bar. It is the shell's own design for every page and is not changed per page.
Luật: `nivo-surface-layering` (below lg the chrome folds).
Grammar: `WorkspaceShell` `navigationDrawer` (`frame/WorkspaceShell/index.d.ts`).
