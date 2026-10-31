# Agent pages ("Agent" and an agent's "Thiết lập")

Design for the two pages a workspace owner uses to add an agent and get it running: the list at `/agents` and the
instance at `/agents/<type>/<installationId>` (tabs Thiết lập, Bàn làm việc, Cài đặt). The owner's request
(2026-10-31): "thiết kế lại 2 trang này lun và xài dc nhé, sao trang lan agent có gap 1 khoảng trên vậy??? phải dính vào
chứ". The owner then ruled that the visual pass waits for the grammar's pane inset release ("đợi các update grammars về
và cook lại ui"): the functional slice ships first, the layout slice after that release. The mockup the lead drew is
the target of the visual pass.

## 1. What each page is for

| page                                 | the reader's question                                                        | what it holds                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/agents`                            | "who works for me, which of them still needs me, and what else could I add?" | my agents (name, role, channel, setup progress, state, next step); the role templates to add (search, group filter, card per role)             |
| `/agents/<type>/<id>`, tab Thiết lập | "what must I still tell this agent before it may answer customers?"          | the 8 required items (gates) with their confirmed values; the private chat with NIVO that proposes those values; the apply action ("Cho chạy") |
| tab Bàn làm việc                     | "what is it doing today?"                                                    | the module's workbench                                                                                                                         |
| tab Cài đặt                          | "how does it run?"                                                           | name, operating mode, live switch, channel grants, sync, removal                                                                               |

## 2. Flows

1. **Create from a role template.** `/agents` → a role card → "Cài đặt" installs the agent (`installModule`) and opens its
   Thiết lập tab. A role that is installed and allows several agents shows "Tạo thêm": it opens the type list
   (`/agents/<type>?list=1`) where "Thêm … mới" asks for a name (prefilled with the next free one) and creates the
   instance (`installModule` with `newInstance`). A single-instance role that is installed leaves the template list.
2. **Setup chat.** The owner writes about the business in plain words; `postSetupMessage` stores the line and queues the
   turn in one transaction; the setup-turn job asks the model once with the checklist and the draft, merges what it
   learned into the draft, proposes confirm cards and writes NIVO's reply. The page polls `setupState` every 2 s while
   the turn is pending. A turn that has not answered within 2 minutes counts as lost: the composer opens again and the
   chat says NIVO did not answer.
3. **Confirm the 8 items.** Each gate is missing, proposed (NIVO filled it) or confirmed. The owner confirms a proposal,
   edits it in their own words ("Lưu và xác nhận", which confirms) or reopens it (`setSetupGate`). Progress reads
   "Đã xác nhận N/8".
4. **Apply / go live.** With 8/8 confirmed, "Áp dụng" freezes the draft as the next context version (`applySetup`); the
   agent then runs on that version. Connecting a channel and the live switch are on Cài đặt (and Kết nối); the header
   says "Chưa gắn kênh" until a channel is bound.
5. **Switch agent.** Today the rail "Agent của bạn" beside the tab; in the visual pass it moves to a menu in the header
   (the mockup's breadcrumb ▾), and "Thêm agent" goes back to `/agents`.

## 3. States

| region                             | loading                                                   | empty                                     | error                                                                          |
| ---------------------------------- | --------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| my agents                          | skeleton cards of the ready shape                         | "Chưa có agent nào" + hint to pick a role | "Không tải được danh sách agent" + retry                                       |
| role templates                     | skeleton cards                                            | "Không có agent nào khớp" + clear filters | same as above                                                                  |
| setup chat                         | bubble skeletons                                          | "Hãy kể cho NIVO về doanh nghiệp của bạn" | slot error + retry; a failed send keeps the text and toasts the server message |
| checklist                          | skeleton rows                                             | every gate "Còn thiếu"                    | slot error + retry                                                             |
| a member who may not set agents up | the chat shows the access notice, the checklist is hidden |                                           |                                                                                |

## 4. Phone

`/agents`: one column; the group filter scrolls sideways; a card keeps its actions. Thiết lập: the checklist sits above
the chat (each its own scroll owner); the header actions wrap under the name; the tabs scroll.

## 5. What confused today (critique)

- The frame draws a rounded `SurfaceCard` inset in a `FillViewport` with a bottom inset: a grey band separates the tab
  line from the panes and the panes never reach the edges or the bottom. The owner's "gap" complaint.
- The rail "Agent của bạn" repeats the list of `/agents` on every tab and takes the width the checklist needs.
- Three columns (rail, chat, checklist) on a laptop leave the chat narrow; the checklist is the thing the owner works
  through, so it deserves the left pane.
- A send that failed on the server left the owner message stored without its turn: the page showed "NIVO đang soạn…"
  forever and locked the composer (fixed, see 6).
- "Cài đặt" on an installed multi-agent role reopened the existing agent instead of adding one (fixed: "Tạo thêm").
- The add-instance dialog kept "Tạo" disabled on the prefilled valid name until the owner typed (fixed).
- The role filter is a segmented control; the canon for a filter over a collection is a selectable `TagGroup`.

## 6. Backend findings

- `AbstractEntity.createdAt` is a plain column with `insert: false`, so `save()` does not hand it back: services that
  map the saved row (`SetupMessagesService.post`, `SetupSessionsService.open`) crashed with
  `Cannot read properties of undefined (reading 'toISOString')` after the row was written. Both now read the row back.
  The same shape may exist in other services that `save()` then map `createdAt`.
- `SetupChatService.postMessage` stored the line outside the transaction that queues its turn; both now commit together.
- `JobClaimService` re-claims with a where string `jobs.jobKey = …` that TypeORM does not translate in an UPDATE: every
  retry dead-letters with `column jobs.jobkey does not exist` (owned by the jobs lane).

## 7. Visual pass (after the grammar pane inset release)

Against the mockup, the layout slice still to do:

1. Instance frame: `Page chrome="bleed"` → `FillViewport bottomInset="none"` → the tab body, no `SurfaceCard`; the
   Thiết lập tab is one `PaneGrid` flush under the tab line, divider full height, reaching the content edges and the
   bottom (checklist pane on the surface, chat on the canvas; `standard`/`wide` checklist track, `fill` chat).
2. Remove the rail; an agent switcher (`DropdownMenu` of the installed agents with "Thêm agent") in the header actions.
3. Checklist pane: progress band on top, each confirmed item shows its value and "Sửa", the next missing item
   highlighted, "Cho chạy (cần đủ 8/8)" pinned at the bottom; draft, knowledge and versions below it.
4. Chat pane: header band "Chat thiết lập với NIVO" with "mỗi câu trả lời được ghi vào mục bên trái", proposals as
   "Mục N" + value with "Xác nhận" / "Sửa lại", composer with suggestion buttons (the next missing items) and the hint
   "Ctrl+Enter để gửi · 0/4000".
5. `/agents`: my agents as `ListRow` rows (avatar, name, role · channel, a `Meter` "Thiết lập N/8", status badge,
   "Tiếp tục thiết lập"); the progress needs a per-installation gate count on `moduleInstallations`; role templates as
   compact cards with a `Mascot size="sm"` beside the copy and the create button on the card; the group filter as a
   selectable `TagGroup`; "+ Tạo agent" in the page header.

Grammar gaps the pass needs: a pane inset (padding inside a `Pane` that lines up every band of the pane), a highlighted
or "current" row state on `ListRow`, and a menu on a breadcrumb item.
