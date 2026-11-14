---
title: Contacts / Chi tiết một người
route: /workspaces/<ws>/contacts/<id>
area: contacts
---
# Contacts, chi tiết một người

Block `ContactsPanes` with frame `ContactDetail` (components/frames/ContactDetail/index.tsx): cards stacked in the well, in the order the owner approved. Drawing: `D:/starci-tmp/claude-20261105/lanes/contacts-20261113/contacts-drawing.md`. Shots missing (no stack yet): `1440.png`, `390.png` in phase 2.

## Thẻ danh tính (người + các cách liên lạc)
Vì sao: first row = the person (avatar, name, "phone · mail" muted) with ONE neutral sm "Sửa" and a ⋯ menu (merge, and for an owner delete); then one row per channel identity: its mark, "Zalo · Tiệm hoa", how it is proven, and at the end the muted reason it joined this person ("số điện thoại trùng", "link liên kết", "đã duyệt gộp"); the footer bands are the "link one more" command and, when there is one, the "Có thể là cùng người" list (below). No red: nothing here is the page's main CTA; delete and unlink are menu items asked again in a confirm dialog.
Luật: `row-padding`, `red-budget-links-foreground`, `page-header-left-sublabel-xs` (sm buttons without icon).
Grammar: `SurfaceCard kind="list"` with `ListRowData action menu meta`, `footers kind="more"` + `kind="custom"`; composite `ContactIdentityCard`.

## Thẻ "Cuộc trò chuyện" + số đếm
Vì sao: one row per conversation (channel, last line, muted time); a row opens the chatbot workbench page that reads it. The count is a chip next to the label. Difference kept on purpose: the drawing draws a separate "Workbench →" link at the end of each row; here the whole row (its title) is the link, so the row has one destination and no second control.
Luật: `table-heroui-native-section-head`, `surfacecard-select-subtitle`.
Grammar: `SurfaceCard kind="list" label count`, `ListRowData href`; composite `ContactConversationsCard`.

## Thẻ "Agent nhớ" (và "Ghi nhớ từ các bước" khi có)
Vì sao: facts as key / value rows, each with a "forget" menu item; the step outcomes the agents keep are a second card with one kind of row (one content per card).
Difference from the drawing (open, not fixable in fe): the drawing's head link "Quản lý →" is NOT drawn. The app has no memory-management page and the schema has no operation behind one (memory comes with the person; `forgetContactMemory` forgets one fact at a time), so the link would lead nowhere. Forgetting lives in each row's menu. To draw the link the back end must give it a destination.
Luật: `table-heroui-native-section-head`, `row-padding`.
Grammar: `SurfaceCard kind="list" layout="keyValue"`; composite `ContactMemoryCards`.

## Thẻ "Từ module" (chỗ module cài khối vào)
Vì sao: the engine page draws no business: installed modules mount their own blocks about this person. ONE card: label "Từ module" with the muted fact "Khối do module cài vào."; each block of each installed agent is a titled section inside it ("Bán hàng · lead"), sections divided by a full-width divider (no card inside a card), each block drawn by the block host from the answer the back end already ran for this person. With no module the same card says so. Status labels inside are plain Badges (no dot). Matches the drawing.
Luật: `nivo-compose-architecture` (blocks come from modules), `badge-dot-or-not`.
Grammar: `SurfaceCard label fact`, `Section title` per block, `Divider`, `SlotView forbidden="hide"`; composite `ContactModulesCard`, leaf `ContactBlockNode`.

## Danh sách "Có thể là cùng người" (trong thẻ danh tính)
Vì sao: a suggestion, never an auto-merge: a bordered inner list (surface in surface; a group named by its sublabel, NOT a card of its own, because a card never stands inside a card) in the footer of the identity card, one row per person: avatar, name, why they may be the same ("cùng tên, chưa có bằng chứng") and ONE neutral sm "Xem" button that opens the person; the ⋯ menu merges (asked again) or dismisses. Drawn only when there is a suggestion. Position: under the identity rows, the card it belongs to (the drawing lists it last; a list can only live inside a card).
Luật: `chat-surfaces` (in-card list = bordered), `row-padding`, `red-budget-links-foreground`.
Grammar: `Section kind="list" sublabel` in a `footers` custom zone of `SurfaceCard`; composite `ContactSuggestionsList`.

## Ngăn kéo sửa / liên kết / gộp và hộp hỏi lại
Vì sao: edit name and tags, link an identity, pick who to merge: short forms, so drawers; deleting a person, cutting a way of reaching them and merging two people are asked again in one confirm dialog (the caller passes the kind: all three are `danger`; never decided from the button's words; the dialog's one CTA is the only red).
Luật: `complex-content-page-not-drawer` (short forms may be drawers), `red-budget-links-foreground`.
Grammar: `Drawer`, `AlertDialog tone`; composites `ContactEditDrawer`, `ContactLinkDrawer`, `ContactMergeDrawer`.

## Đang tải / người không còn
Vì sao: the person's cards draw as geometry with real labels (`DETAIL_PLACEHOLDER`); a person who is gone says so with the way back to the list.
Luật: `page-loading-own-shape`.
Grammar: `SlotView emptyAction`.
