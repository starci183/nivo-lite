---
title: Contacts / Chi tiết một người
route: /workspaces/<ws>/contacts/<id>
area: contacts
---
# Contacts, chi tiết một người

Block `ContactsPanes` with frame `ContactDetail` (components/frames/ContactDetail/index.tsx): separate white blocks stacked in the well (the right column of the two-column well), in the order of drawing v2. Drawing: `D:/starci-tmp/claude-20261105/lanes/contacts-20261113/contacts-drawing-v2.md` (owner "ok", 2026-11-14; v1 `contacts-drawing.md` before it). Source written 2026-11-14 and type-checked only: NOT visually verified, no shots yet (`1440.png`, `390.png` to be taken by the screenshot check).

## 1. Thẻ danh tính (người + các cách liên lạc)
Vì sao: the first row is the person (avatar, name 14 medium, "phone · mail" 12 muted, or "Chưa có số điện thoại hay e-mail") with ONE neutral sm "Sửa" and a ⋯ menu (link one more way, merge, and for an owner delete); then one row per way to reach them: for a channel its mark and "Zalo · <tên kết nối>" (the connection's own name), for a phone or mail its value; at the end, muted, WHY it is linked ("kênh xác nhận", "số điện thoại trùng", "link liên kết", "đã duyệt gộp"). When the staff hold the conversation on that channel account (`routes[].holder`), the channel row carries a 12 muted second line "Đang do <tên> giữ" (no chip, no new component; "Đang do nhân viên giữ" when the seat is gone); the row is matched to its route by the connection id. Linking one more identity lives in the person's menu; the old bare "Liên kết danh tính" band under the rows is gone. No red: nothing here is the page's main CTA; delete and unlink are menu items asked again in a confirm dialog.
Luật: `row-padding`, `red-budget-links-foreground`, `page-header-left-sublabel-xs` (sm buttons without icon), `type-scale-14-12`.
Grammar: `SurfaceCard kind="list"` with `ListRowData action menu meta`; composite `ContactIdentityCard`.

## 2. Thẻ "Lịch sử trò chuyện" (mới)
Vì sao: the owner wants the person's chat history across every connected platform on the person's own page. ONE card: label + count (left out while older lines exist, since only the loaded lines are counted); in the header zone UNDERLINE tabs (a secondary filter of this block): "Tất cả" and one tab per route the person has (`contact.routes`, most recently spoken on first; a channel the person is on through two accounts gets two tabs "Zalo · <tên kết nối>", because the API narrows a read to one route); the body is the thread by time, oldest of the loaded page at the top, with a 12 muted day separator ("Hôm nay · Zalo": the channel is named only on the "Tất cả" tab); each line is the Grammar's chat bubble with its caption "who · time" ("Khách", "Lan (agent)", "An (nhân viên)"), the name coming from the server's `speaker { kind, name }`; the person's and the agents' lines are the flat surface at the start, a member of the shop's own typed line is the accent fill at the end; files are the chat's attachment tiles; the footer zone says it is read only ("Chỉ xem. Trả lời khách ở Workbench…"); "Xem thêm" loads the next older page. States stay inside the card and come from one `DataSlot` through `SlotView`: loading keeps the tabs and draws bubble geometry, empty is "Chưa có tin nhắn nào với người này.", a failed read is the neutral failure notice with its retry. The head link "Mở trong Workbench →" is the workbench of the agent that spoke last on the route (`routes[].workbench`, link `/agents/<module>/<installation>/workbench`): the tab's own route, on "Tất cả" the most recently active route's; hidden when that is null (no agent has spoken there yet).
Data: `contactMessages(input: { contactId, routeId?, before?, limit })`: ONE merged server read, newest first, one cursor (`next`); "Tất cả" omits `routeId`, a route's tab passes it; "Xem thêm" passes the cursor; the thread is the pages reversed (oldest first, the server's order kept). READ ONLY here.
Open: order cards (`orderJson`) belong to the order-card section below the history card, not here; the thread stands on the card's white face (the Grammar has no thread-on-background zone inside a card), so the flat-surface bubble is white on white: to be judged in the screenshot check.
Order card in a line (FE-ORDERCARD, 2026-11-14, NOT visually verified): a line an agent told with an order (`orderJson`, the sender's `LineOrder` snapshot = `customer_messages.order_card`: order number, items, total in words, delivery line, paid) shows as the SAME order card the workbench thread draws (branch `ThreadOrderCard`, the anatomy of blocks-core `ThreadOrderCard`): the number (14 strong) with a plain Badge (success "Đã thanh toán" / neutral "Chờ thanh toán", no dot) at the end, then the body the registered `order.summary` view draws (bordered inner list of items: photo/initials, name, "× n · price", amount at the end; then "Tổng" strong and "Giao" rows at 12 muted label + 14 value). It stands in the bubble footer above the files, no card of its own, no pay / confirm control (read only). Amounts are the snapshot's own text with its currency (what the customer saw), never re-formatted; staff lines keep the accent bubble. A snapshot that does not parse shows the line's words alone, no crash. Screenshot check: the card is readable inside both the flat white incoming bubble and the accent outgoing one, the inner list border is visible on white, nothing under 12.
Luật: `chat-surfaces` (flat surface, own line = accent), `surfacecard-zones-api` (underline = secondary tabs in a header zone, custom footer zone), `page-loading-own-shape`, `unhandled-case-tells-customer` (the failure is said in place).
Grammar: `SurfaceCard` with `headers: [{ kind: "filter" }]`, `footers: [{ kind: "custom" }]`, `labelEnd` + `Link variant="head"`; `MessageBubble`, `Divider label` for day separators; leaf `ChatMessageFiles`; `SlotView frame`; composite `ContactHistoryCard`.

## 3. Thẻ "Việc agent đã làm" (+ số đếm)
Vì sao: what the agents did for this person, newest first (`contactWork`): row title = "<tên quy trình> · <tên bước>" in the workspace language; the step label missing gives the workflow label alone; both missing give the neutral "Việc của agent"; second line 12 muted = the status LABEL for the three values the data has ("Xong", "Hỏng", "Bỏ qua"; "Đang chờ / Đã dừng / Đã huỷ" are gone, the data never has them; any other status shows no second line); time at the end. "vòng N" is appended only when two rows would otherwise read the same. NEVER a key (`sales.consult`, `talk[r1].opening`, `done`). Hidden when there is none (or while the read has not answered).
Luật: `badge-dot-or-not` (a status is a label, not a dot), `row-padding`, `type-scale-14-12`.
Grammar: `SurfaceCard kind="list"` with a `description` node (12 muted) and `meta`; composite `ContactNotesCard`.

## 4. Thẻ "Agent nhớ"
Vì sao: facts as key / value rows, each with a "forget" menu item; the standard empty notice "Agent chưa nhớ gì về người này." The head link "Quản lý →" stays hidden (no destination exists yet: when a product decision names one, draw it as `labelEnd` + `Link variant="head"`). It is NOT drawn: the app has no memory-management page and the schema no operation behind one (R4-NOTES), so the link would lead nowhere.
Luật: `table-heroui-native-section-head`, `row-padding`.
Grammar: `SurfaceCard kind="list" layout="keyValue"`, `EmptyNotice`; composite `ContactMemoryCard`.

## 5. Thẻ "Từ module" (chỗ module cài khối vào)
Vì sao: the engine page draws no business: installed modules mount their own blocks about this person. ONE card: label "Từ module" with the muted fact "Khối do module cài vào."; each block of each installed agent is a titled section inside it, the sections one row step apart (no hand-made divider rows: the Grammar refuses a divided `Stack` inside a surface), each block drawn by the block host from the answer the back end already ran for this person. Hidden when no module mounts a block (drawing v2; `SlotView empty="collapse"`).
Luật: `nivo-compose-architecture` (blocks come from modules), `badge-dot-or-not`.
Grammar: `SurfaceCard label fact`, `Section title` per block, `SlotView forbidden="hide" empty="collapse"`; composite `ContactModulesCard`, leaf `ContactBlockNode`.

## 6. Thẻ "Có thể là cùng người"
Vì sao: a suggestion, never an auto-merge: its own white block labelled on the pink with a count, holding a bordered inner list (surface in surface, the only card-in-card the Grammar allows): row = avatar, name, why they may be the same (muted, "cùng tên, chưa có bằng chứng") and ONE neutral sm "Xem" button that opens the person; the ⋯ menu merges (asked again) or dismisses. Hidden when there is none. It is no longer a footer of the identity card, and no bare text row replaces it.
Luật: `chat-surfaces` (in-card list = bordered), `row-padding`, `red-budget-links-foreground`.
Grammar: `SurfaceCard` body + `Section kind="list" ariaLabel`; composite `ContactSuggestionsList`.

## Ngăn kéo sửa / liên kết / gộp và hộp hỏi lại
Vì sao: edit name and tags, link an identity, pick who to merge: short forms, so drawers; deleting a person, cutting a way of reaching them and merging two people are asked again in one confirm dialog (the caller passes the kind: all three are `danger`; the dialog's one CTA is the only red).
Luật: `complex-content-page-not-drawer` (short forms may be drawers), `red-budget-links-foreground`.
Grammar: `Drawer`, `AlertDialog tone`; composites `ContactEditDrawer`, `ContactLinkDrawer`, `ContactMergeDrawer`.

## Đang tải / người không còn
Vì sao: the person's blocks draw as geometry with real labels (`DETAIL_PLACEHOLDER`; the conversation card keeps its tabs and draws bubble shapes); a person who is gone says so with the way back to the list.
Luật: `page-loading-own-shape`.
Grammar: `SlotView emptyAction`, `SurfaceCard isLoading`.
