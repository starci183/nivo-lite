---
title: Tri thức (Kế toán)
route: /workspaces/<ws>/agents/<module>/<installation>/knowledge
area: agent-knowledge
---
Route `/workspaces/<ws>/agents/<module>/<installation>/knowledge`. Block `AgentKnowledge` draws one well: what waits for the owner, the table of knowledge sources the agent reads and the list of sample answers. The old layers table, aside and loose notes are gone.

Grammar paths are under `node_modules/@starci/grammar/dist/core/`. Shots: `1440.png`, `1920.png`, `390.png`, taken in the Next dev server (the round N button and the Compiling pill are Next dev overlays, not app UI).

## Dải đầu trang (đường dẫn, tên agent, trạng thái, tab)
Vì sao: the white header band never scrolls: trail, agent mark and name with the status chip, one tab row (Bàn làm việc, Công việc, Graph, Quy trình, Trò chuyện, Kết nối, Tri thức, Thiết lập) with 12px count chips (grey for the grants on Kết nối, pink for the 73 facts that wait for the owner). It is the `AgentInstanceFrame` band shared by every agent tab and owned by the agent-frame lane, not by this page; the 20px left offset on chat tabs against the 40px of card tabs (`hasPanes` drops the gutter) and the raw ">" tab overflow button at 390 are tracked there.
Luật: `page-header-left-sublabel-xs` (band flush left), `table-heroui-native-section-head` (tab counts are chips; header band never scrolls).
Grammar: `Page` `header` with `tabs` and `breadcrumbs` (`frame/Page/index.d.ts`, `frame/PageHeader/index.d.ts`); app block `AgentInstanceFrame`.

## Thẻ "Cần bạn duyệt" (nhãn, số, một hàng, nút "Duyệt ở Việc cần làm")
Vì sao: the facts that wait for the owner are one attention card in the same place whether or not there are any: label with the count at the start, one row (what, why) and the one primary action at the end. A card, not a frameless banner.
Luật: `table-heroui-native-section-head` (one content per card; owner work flagged in one place), `suggestion-button-sm`.
Grammar: `SurfaceCard kind="list"` `fact` row `action` with `isPrimary` (`frame/SurfaceCard/index.d.ts`, `surfaceCardData.d.ts`).

## Bảng nguồn tri thức (Nguồn, Loại, Cập nhật, Trạng thái, phân trang, "Thêm nguồn →")
Vì sao: a table drawn as a white list card (Grammar 0.37.8+, no grey frame, muted 12 column labels on white, full-width row dividers) with the 0.37.9 column rule: short columns are fit + one line and never wrap, only the fill column truncates: the source column fills (minimum width, one-line ellipsis), kind, updated and status fit their content, kind and updated leave below tablet, so no column collapses to one character. The head has the label with a count chip and one link "Thêm nguồn →"; the footer is the pagination with its "1–6 trên 7 nguồn" summary; on a phone each row is a list item.
Luật: `table-heroui-native-section-head` (SUPERSEDED block: the table is a white list card, not the grey frame; section head with one link stays), memory "Table columns" (width fill / fit / px, hideBelow, phone list).
Grammar: `DataTable` `columns` `width` `minWidth` `truncate` `hideBelow` `footer` `phone="list"` (`branch/DataTable/index.d.ts`), `Pagination summary` (`composite/Pagination/index.d.ts`), `Link variant="head"`.

## Danh sách "Câu trả lời mẫu" (câu hỏi, câu trả lời, "Thêm câu trả lời →")
Vì sao: the facts only this agent reads as a list card: the question is the row title and the answer its description, so there is no loose line; the head link writes a new one and an empty list draws a frameless notice inside the card.
Luật: `surfacecard-select-subtitle` (subtitle only directly under a title), `table-heroui-native-section-head`.
Grammar: `Section kind="list"` `count` `action` (`frame/Section`, `surfaceCardData.d.ts` `ListRowData`).

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
