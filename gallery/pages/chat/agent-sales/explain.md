---
title: Trò chuyện / Agent Sales (trực tiếp)
route: /workspaces/<ws>/chat?room=<id>
area: chat
---
Route `/workspaces/<ws>/chat`. Page `features/pages/TeamChatPage` draws the trail alone in the header (no title band) and one `PaneGrid`: the rooms of the viewer in one pane and the room in the other, the thread as the room pane body and the composer as its `footer` (block `TeamChatRoom`, `TeamChatPanes`). The direct room with the Sales agent: order cards with the head link.

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

## Vùng chat toàn chiều rộng (đầu phòng cố định, luồng cuộn, ô nhập cố định)
Vì sao: a chat pane is full-bleed Layout B: `Pane surface content="full"` whose body is the room head and the thread and whose `footer` is the composer. Only the thread scrolls; the head and the composer stay at the pane edges at 1440, 1920 and 390 (checked in the shots: long thread, head and composer both visible). There is no aside any more.
Luật: `table-heroui-native-section-head` (scroll: header band never scrolls, chat scrolls only the thread; chat panes are full-bleed), `nivo-surface-layering`.
Grammar: `Pane` `footer` and `content="full"` (`frame/PaneGrid/index.d.ts`, 0.37.5), `PaneSection scroll role="log"` (`frame/PaneSection/index.d.ts`); app block `TeamChatRoom` (`teamChatRoomPartsOf`).

## Đầu phòng chat (tên, "Agent", ghim, thành viên, tắt chuông)
Vì sao: the head on the surface under a separator: avatar mark with the agent chip, name 14/500, "Agent" 12 muted, and at the end three outlined round icon buttons (pinned, members, mute) that open drawers or toggle mute. It stays at the top while the thread scrolls.
Luật: `type-scale-14-12`, `nivo-surface-layering` (head on the surface).
Grammar: `PaneHeader` `title` `description` `mark` `actions` (`composite/PaneHeader/index.d.ts`) through app frame `ChatRoomHead`; `IconButton intent="neutral"` (`leaf/IconButton/index.d.ts`).

## Luồng tin nhắn (nền trắng, mốc ngày, nhóm theo người gửi)
Vì sao: the thread is on the white surface with white bubbles for others and red for the viewer, a day divider, the sender named once at the head of a run and the agent avatar at its foot. Identical repeated notices of one agent fold into one cautionary row with the count and the first-last time (see the notice row).
Luật: `pink-page-surface-rule` (a chat is a pane, not a pink well), `type-scale-14-12`.
Grammar: `PaneSection scroll={{ role: "log", tone: "surface", align: "end" }}` via app frame `ChatThreadBand`; `MessageBubble` (`composite/MessageBubble/index.d.ts`); `Divider label`.

## Thông báo lặp của agent gộp một hàng ("×N · giờ đầu–giờ cuối", Xem)
Vì sao: identical notices that one agent or the system posts one after another ("... cần bạn quyết định ...") become one cautionary row: the first words bold, the rest muted, "×N · first–last time", and a row action that opens the repeats and folds them again. The rule is general (same sender, same text, no card, file or reply), not tied to one message.
Luật: `table-heroui-native-section-head` (work waiting on the owner is flagged once), `type-scale-14-12`.
Grammar: `Alert tone="cautionary" action={{ kind: "row" }}` (`composite/Alert/index.d.ts`) in app composite `ChatNoticeGroup`, folded by `frames/TeamChatMessages`.

## Thẻ đơn hàng trong luồng (Đơn mới DH-…, Thông báo, Mở đơn →, ghim)
Vì sao: an order message is a compact card at the bubble measure (Grammar `standard`, at most 40rem, not 70% of the row): the head holds the order number, the "Thông báo" chip, the head link "Mở đơn →" and the pin; the body is the product row, then "Tổng · Khách · Giao" as small term and value lines. The old stacked key-value block and the bottom button are gone. A true 30rem cap needs a Grammar measure for `MessageCard` (gap, see the report).
Luật: `table-heroui-native-section-head` (navigation link has an arrow that slides; one content per card), `page-header-left-sublabel-xs` (no sm button with an icon).
Grammar: `MessageCard` `measure="standard"` (`composite/MessageCard/index.d.ts`), `Link variant="head"` (`leaf/Link/index.d.ts`); app composite `TeamChatAgentCard` and blocks-core `OrderBody`.

## Hành động ẩn cạnh bong bóng (ghim, phản hồi, trả lời, chia sẻ)
Vì sao: the actions of a message appear only on hover or focus beside its bubble: the reaction toolbar, reply and share come from `MessageBubble` itself and the pin is one standard-size round icon button (the small icon-only variant that showed as an empty 36px box was removed). Nothing draws at rest, and the toolbar sits beside the bubble, never over its text.
Luật: `page-header-left-sublabel-xs` (no sm button carries an icon), `type-scale-14-12`.
Grammar: `MessageBubble` `actions` `reactions` (`composite/MessageBubble/index.d.ts`, `Reactions.d.ts`); `IconButton` (`leaf/IconButton/index.d.ts`).

## Gợi ý nhanh trên ô nhập
Vì sao: three questions to the agent as a row of neutral small pill buttons over the field, hidden once a draft exists: the one suggestion pattern. They wrap on a phone.
Luật: `suggestion-button-sm`, `page-header-left-sublabel-xs` (sm buttons have no icon).
Grammar: `Button intent="neutral" size="sm"` in a `Cluster` (`leaf/Button/index.d.ts`, `frame/Cluster/index.d.ts`) inside `PaneSection as="footer"`; app frame `ChatComposerBand`.

## Ô nhập tin (đính kèm, nhiều dòng, gửi)
Vì sao: a Textarea of two rows that grows to six, with the send button inside the box at the bottom right and a round paperclip outside at the start; Enter sends, Shift+Enter breaks the line. It is the pane `footer`, so it never scrolls away.
Luật: `page-header-left-sublabel-xs` (every chat composer is two rows minimum, send inside), `type-scale-14-12`.
Grammar: `Textarea rows={2} send onSubmitShortcut` (`branch/Textarea/index.d.ts`); `Pane footer`; app composite `TeamChatComposer`.

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
