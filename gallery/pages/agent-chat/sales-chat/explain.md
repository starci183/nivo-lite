---
title: Trò chuyện (Sales)
route: /workspaces/<ws>/agents/<module>/<installation>/chat
area: agent-chat
---
Route `/workspaces/<ws>/agents/<module>/<installation>/chat`. Page `features/pages/AgentChatTabPage` draws the one team chat room (`components/blocks/TeamChatRoom`, `AgentTeamChatPanes`) as one full-width pane with the thread as its body and the composer as its footer. The same page serves Accounting, Chatbot and Sales; Sales shows order cards.

Grammar paths are under `node_modules/@starci/grammar/dist/core/`. Shots: `1440.png`, `1920.png`, `390.png`, taken in the Next dev server (the round N button and the Compiling pill are Next dev overlays, not app UI).

## Dải đầu trang (đường dẫn, tên agent, trạng thái, tab)
Vì sao: the white header band never scrolls: trail, agent mark and name with the status chip, one tab row (Bàn làm việc, Công việc, Graph, Quy trình, Trò chuyện, Kết nối, Tri thức, Thiết lập) with 12px count chips (grey for the grants on Kết nối, pink for the 73 facts that wait for the owner). It is the `AgentInstanceFrame` band shared by every agent tab and owned by the agent-frame lane, not by this page; the 20px left offset on chat tabs against the 40px of card tabs (`hasPanes` drops the gutter) and the raw ">" tab overflow button at 390 are tracked there.
Luật: `page-header-left-sublabel-xs` (band flush left), `table-heroui-native-section-head` (tab counts are chips; header band never scrolls).
Grammar: `Page` `header` with `tabs` and `breadcrumbs` (`frame/Page/index.d.ts`, `frame/PageHeader/index.d.ts`); app block `AgentInstanceFrame`.

## Vùng chat toàn chiều rộng (đầu phòng cố định, luồng cuộn, ô nhập cố định)
Vì sao: a chat pane is the chat frame (room head + thread + composer footer) and it is drawn on `--background` (pink) on any page that renders a chat, even when the pane sits among white panes; the room list pane beside it stays the white surface. Probed at 1440 (Grammar 0.37.33): head band, thread and composer footer are all `--background`, the composer field is white. Only the thread scrolls: the `role="log"` element has scrollHeight greater than clientHeight on a long room and the pane body does not scroll; it opens at the newest message (scrollTop at the bottom). The head and the composer stay at the pane edges at 1440, 1920 and 390.
Luật: DNA-COMMON-CHAT-FRAME (the chat frame is `--background` regardless of the surface under it), DNA-COMMON-CHAT-FRAME-SCROLL (only the thread scrolls, the newest message is in view on open), `chat-surfaces`, `table-heroui-native-section-head` (header band never scrolls).
Grammar: `Pane content="chat"` (Grammar 0.37.33, `frame/PaneGrid/index.d.ts`): head, `PaneSection scroll role="log"` thread and `footer` composer in one pane; app block `TeamChatRoom` (`teamChatRoomPartsOf`) chooses no tone.

## Thẻ đơn hàng trong luồng (Đơn mới DH-…, Thông báo, Mở đơn →, ghim)
Vì sao: an order message is a compact card at the bubble measure (Grammar `standard`, at most 40rem, not 70% of the row): the head holds the order number, the "Thông báo" chip, the head link "Mở đơn →" and the pin; the body is the product row, then "Tổng · Khách · Giao" as small term and value lines. The old stacked key-value block and the bottom button are gone. A true 30rem cap needs a Grammar measure for `MessageCard` (gap, see the report).
Luật: `table-heroui-native-section-head` (navigation link has an arrow that slides; one content per card), `page-header-left-sublabel-xs` (no sm button with an icon).
Grammar: `MessageCard` `measure="standard"` (`composite/MessageCard/index.d.ts`), `Link variant="head"` (`leaf/Link/index.d.ts`); app composite `TeamChatAgentCard` and blocks-core `OrderBody`.

## Đầu phòng chat (tên, "Agent", ghim, thành viên, tắt chuông)
Vì sao: the head sits on `--background` under a 1px separator (part of the chat frame, not the white chrome): avatar mark with the agent chip, name 14/500, "Agent" 12 muted, and at the end three outlined round icon buttons (pinned, members, mute) that open drawers or toggle mute. It stays at the top while the thread scrolls.
Luật: `type-scale-14-12`, DNA-COMMON-CHAT-FRAME (head is part of the chat frame, `--background`).
Grammar: `PaneHeader` `title` `description` `mark` `actions` (`composite/PaneHeader/index.d.ts`) through app frame `ChatRoomHead`; `IconButton intent="neutral"` (`leaf/IconButton/index.d.ts`).

## Luồng tin nhắn (nền background, mốc ngày, nhóm theo người gửi)
Vì sao: the thread sits on `--background` (the pink well, never white); a message of others or of an agent is a flat white `--surface` bubble with no shadow and no border (a message, not a card); the viewer's own message is `--accent` with `--accent-foreground` text; a day divider, the sender named once at the head of a run and the agent avatar at its foot. Identical repeated notices of one agent fold into one cautionary row with the count and the first-last time (see the notice row).
Luật: DNA-COMMON-CHAT-FRAME (head, thread and composer footer on `--background`), `type-scale-14-12`. `chat-surfaces` (flat bubbles: thread on `--background`, others flat `--surface`, own `--accent`, no empty band above the composer's suggestion row).
Grammar: `PaneSection scroll={{ role: "log", align: "end" }}` via app frame `ChatThreadBand` (no `tone`: a `role="log"` thread is always on `--background`, Grammar 0.37.33 laws DNA-COMMON-CHAT-SURFACES and DNA-COMMON-CHAT-FRAME-SCROLL); `MessageBubble` (`composite/MessageBubble/index.d.ts`); `Divider label`.

## Thông báo lặp của agent gộp một hàng ("×N · giờ đầu–giờ cuối", Xem)
Vì sao: identical notices that one agent or the system posts one after another ("... cần bạn quyết định ...") become one cautionary row: the first words bold, the rest muted, "×N · first–last time", and a row action that opens the repeats and folds them again. The rule is general (same sender, same text, no card, file or reply), not tied to one message.
Luật: `table-heroui-native-section-head` (work waiting on the owner is flagged once), `type-scale-14-12`.
Grammar: `Alert tone="cautionary" action={{ kind: "row" }}` (`composite/Alert/index.d.ts`) in app composite `ChatNoticeGroup`, folded by `frames/TeamChatMessages`.

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

## Ngăn kéo tin đã ghim và thành viên
Vì sao: pinned messages and members open in a right Drawer over the page so the thread keeps its place; the pinned drawer redraws the same bubbles and cards. Closed in the shots.
Luật: `nivo-surface-layering` (overlay on the surface).
Grammar: `Drawer placement="right"` (`frame/Drawer/index.d.ts`).

## Nút NIVO AI nổi
Vì sao: the round assistant button sits bottom right. On pages with a composer the guide block (`GuideBubble`, owned by the guide lane) lifts it above the composer and steps it aside while a text field has focus, so it no longer covers the field; it is the one floating control of the app.
Luật: `suggestion-button-sm` (the assistant entry), `blocks-are-real-code`.
Grammar: `AvatarButton size="floating"` (`leaf/AvatarButton/index.d.ts`) in app block `GuideBubble`.

## Thanh trên và thanh bên
Vì sao: the console shell chrome on the white surface: workspace lockup, round language dropdown, sun/moon switch, account avatar; the sidebar with the open destination in soft pink and the one pink count chip (Second Brain, work waiting for the owner). Nothing page-specific; the round N button and the pills at the foot are Next dev overlays.
Luật: `nivo-surface-layering` (chrome is white), `locale-switch-round-dropdown`, `table-heroui-native-section-head` (pink chip only for work waiting on the owner).
Grammar: `WorkspaceShell` `header` and `navigation` (`frame/WorkspaceShell/index.d.ts`); `TopBar`, `Sidebar` (`composite/TopBar`, `composite/Sidebar`); app blocks `ConsoleHeader`, `ConsoleNavigation`.

## Điện thoại 390
Vì sao: one column: the band stacks (menu row, trail, identity, tabs), the room head keeps its three round buttons, the thread scrolls between the head and the composer, the suggestions wrap to rows and the composer is a full-width field. The tab overflow ">" is the band's (agent-frame lane); the assistant button is lifted by the guide block.
Luật: `page-header-left-sublabel-xs`, `suggestion-button-sm`, `table-heroui-native-section-head` (phone rules).
Grammar: `Tabs` overflow (`branch/Tabs/index.d.ts`), `Textarea`, `Cluster`.
