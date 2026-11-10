---
title: Trò chuyện, danh sách phòng
route: /workspaces/<ws>/chat?room=<id>
area: chat
---
Route `/workspaces/<ws>/chat`. Page `features/pages/TeamChatPage` draws the trail alone in the header (no title band) and one `PaneGrid`: the rooms of the viewer in one pane and the room in the other, the thread as the room pane body and the composer as its `footer` (block `TeamChatRoom`, `TeamChatPanes`). No room is open.

Grammar paths are under `node_modules/@starci/grammar/dist/core/`. Shots: `1440.png`, `1920.png`, `390.png`, taken in the Next dev server (the round N button and the Compiling pill are Next dev overlays, not app UI).

## Dải đầu trang (chỉ đường dẫn "Tổng quan / Trò chuyện")
Vì sao: a compact trail row and nothing else: no title (the pane head and the sidebar already say "Trò chuyện"), no empty band. It does not scroll.
Luật: `page-header-left-sublabel-xs` (band flush left, no empty stretched band), `table-heroui-native-section-head` (header band never scrolls).
Grammar: `Page chrome="panes"` `header={{ breadcrumbs }}` (`frame/Page/index.d.ts`, trail-only content); `Breadcrumbs` (`composite/Breadcrumbs`).

## Đầu danh sách phòng ("Trò chuyện" + "Cuộc mới") và ô tìm
Vì sao: the rooms pane head: the label at the start and one neutral small pill "Cuộc mới" at the end (no icon, not the primary), then one search field that filters by name or last line. Sections "Nhóm" and "Agent" under 12px muted labels.
Luật: `page-header-left-sublabel-xs` (sm buttons carry no icon), `suggestion-button-sm`, `type-scale-14-12`.
Grammar: `PaneHeader` `title` `actions` (`composite/PaneHeader/index.d.ts`), `Button intent="neutral" size="sm"`, `SearchField`, `ListBox sections` (`branch/ListBox/index.d.ts`); app blocks `TeamChatRooms`.

## Dòng xem trước của phòng ("Bạn: …")
Vì sao: the last line of a row names the author; when the author is the viewer it reads "Bạn:" instead of the raw account slug ("nivo-owner:"). The viewer is found among the room members by id and compared to the author name.
Luật: `type-scale-14-12` (12 muted meta must read as language, not data), `blocks-are-real-code`.
Grammar: `ListBoxItem description descriptionLines={1}` (`branch/ListBox/index.d.ts`); code `hooks/teamChat/teamChat.shared.ts` (`previewOf`).

## Vùng phòng khi chưa mở phòng nào
Vì sao: with no room open the room pane shows a frameless notice that asks to pick a person, an agent or a group (on a phone only the list shows, and tapping a room opens the room alone with a back arrow in its head).
Luật: ui-laws "EmptyNotice on a pane is frameless".
Grammar: `EmptyNotice` (`composite/EmptyNotice/index.d.ts`); app `PaneBlank`.

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
