---
title: Trò chuyện / Chatbot (thẻ quy trình đang dừng)
route: /workspaces/<ws>/chat?room=<id>
area: chat
---
Route `/workspaces/<ws>/chat?room=<id>`, the direct room with the Chatbot agent, scrolled to a live typed `workflow.stopped` card (`ChatMessageType.stop`, state `open`, kind `ai_report`, revision 0 = an old-engine stop read through the typed field). Shots `1440.png`, `1920.png`, `390.png` from the Next dev server, read only (no decision was pressed). The rest of the page (rooms pane, room head, composer) is explained in `chat/agent-sales`; the chat frame (head, thread, composer footer) is `--background` and only the thread scrolls (Grammar 0.37.33 `Pane content="chat"`, DNA-COMMON-CHAT-FRAME, DNA-COMMON-CHAT-FRAME-SCROLL). Approved drawings: `lanes/drawings/chat-approval-card-20261113.html` (card 2, 2026-11-13: the NEW one, it wins where it differs) and the older `lanes/drawings/stop-card.html` (answer box, decisions, trace, leave request). The shots below were taken BEFORE the 2026-11-13 change (head "Workflow dừng · … › …", worded facts always listed, "Chi tiết kỹ thuật" fold, preview slot): phase 2 retakes all three (list at the end).

## Thẻ dừng: tác giả, dòng phụ, khung thẻ
Vì sao: one card per stop, rewritten in place (same message id). The agent name and the muted 12 line "<giờ>[ · lần N]" stand above the card like every other message of the thread, the agent mark beside it; the card face is the surface card at the wide chat measure. The workflow and step moved into the head (next section), so the muted line no longer repeats them. Where the old engine sends keys as titles (engine debt, not drawn by the web) the head shows those keys.
Luật: `type-scale-14-12` (meta 12 muted, text 14), `chat-surfaces` (the thread is on `--background`; a message of an agent is flat `--surface` white: no shadow, no border; it is a message, not a card), `blocks-core-pure-edge-to-chat` (the engine reports to /chat), `lead-freeze-on-failure`.
Grammar: `MessageCard measure="wide" author avatar title chip meta body` (`composite/MessageCard/index.d.ts`, 0.37.30: the content column fills the card, so the nested lists and the composer span it); app composite `components/composites/TeamChatStopCard`.

## Tiêu đề + chip trạng thái
Vì sao: the head reads "Workflow dừng · <quy trình> › <bước>" (drawing 2026-11-13; the web composes it from the typed stop, so the owner sees WHERE it stopped first), at weight 600, with the state chip at the row end. A leave request (kind approval) keeps the engine's own headline (it names who asks for what). The drawing's muted "workflow.stopped" at the head right is an annotation, not drawn: the time lives in the muted line under the card. Chip words are the web's: open + AI = "Cần bạn quyết" (accent), open + NIVO = "NIVO báo" (neutral), "Đã trả lời" / "Đã xong" (success), "Đã bỏ qua" / "Hết hạn" (neutral), after a take-over "Bạn đang tiếp quản" (warning). Tones are Grammar Badge tones, no new colour.
Luật: `owner-colors-exact`, `type-scale-14-12`.
Grammar: `MessageCard title` + `chip={<Badge tone>}` beside it, `Badge tone` (`leaf/Badge/index.d.ts`, built-in tones).

## Lời nhắn và câu hỏi
Vì sao: the engine's `message` (the reason), then its `question` at weight 600 (drawing: the question is the bold line), 14 text; raw facts never stand here.
Luật: `type-scale-14-12`, `unhandled-case-tells-customer` (words come from the engine/AI, not coded).
Grammar: `Text` (`leaf/Text/index.d.ts`).

## Danh sách có viền: các dữ kiện đã diễn đạt + "Lần dừng"
Vì sao: the drawing lists the worded facts ("Tài khoản SePay 9999") and the row "Lần dừng 1 · 10:02" (how many times and when) as ONE bordered list right under the question, always visible (before, every fact was folded). Facts flagged `technical` never stand here. A leave request keeps its own lines list (account, ability, arguments) instead and has no "Lần dừng" row.
Luật: `stop-card-design` (inner lists bordered, surface in surface), `surfacecard-select-subtitle`, `row-control-clearance`, `type-scale-14-12` (the drawing's 13px rows are drawn at 14: no 13).
Grammar: `SurfaceCard kind="list" layout="keyValue"`.

## Xem trước (preview) của gói
Vì sao: a package may draw a preview of what the step was doing (a draft, an order summary). The slot sits after the list and before the suggestions, same as on the approval card; drawn through the view registered for `preview.kind` in `agentMessageViews`, and nothing at all (no frame, no label) for no preview, an unknown or core kind, or a payload that fails the kind's schema. NOT live yet: the typed stop (`ChatStopCardType`) has no `preview` field until ENGINE-FIX adds it, so the slot draws nothing today.
Luật: `nivo-compose-architecture` (the package draws its own part), `blocks-are-real-code`.
Grammar: the view of the kind (hook `useStopPreview`, rule `stopPreviewViewOf`).

## Gợi ý trả lời
Vì sao: the list has the label "Gợi ý" above it (the SurfaceCard `label`, drawing), then one press on a row sends that text as the answer (`decideRunStop action answer`). The suggestions inside the card are one bordered list, a plain-text row per suggestion with a chevron (surface in surface); the pills by the composer stay `Button sm`. The drawing shows a small button at the end of each suggestion row ("Chạy lại", "Mở đơn"): NOT drawn, the Grammar law wins (DNA-COMMON-CARD-SUGGESTIONS: the whole row is the one button, trailing chevron, never a second control in it), and a link target ("Mở đơn") is not in the typed stop.
Luật: `chat-surfaces` (in-card suggestions = bordered list), `suggestion-button-sm` (composer chips only).
Grammar: `SurfaceCard kind="list" layout="suggestions"` with `onPress` rows (0.37.31, `surfaceCardData.d.ts` `ListData`, law DNA-COMMON-CARD-SUGGESTIONS).

## Ô trả lời + Gửi
Vì sao: drawn only when `needs.answer`; a composer of 2 to 6 lines (Enter sends) and the one red primary "Gửi", the only red CTA of the card and the only button with an icon. Disabled until there is text. Placeholder "Trả lời cho AI..." (AI report) or "Nhắn thêm ngữ cảnh cho AI..." (AI error).
Luật: `red-budget-links-foreground` (one red CTA), `page-header-left-sublabel-xs` (composer min 2 rows), `verify-against-visualize` (only the primary carries an icon).
Grammar: `Textarea onSubmitShortcut isLabelHidden` (`branch/Textarea/index.d.ts`, `COMPOSER_MIN_ROWS`), `Button intent="commit" startGlyph="send"`.

## Hàng quyết định: Thử lại / Tiếp quản / Bỏ qua
Vì sao: under a separator, only the decisions `needs.decisions` lists, as neutral sm buttons (decide door `decideRunStop`; toast "Đã xử lý" / "Đang áp dụng", then the thread is read again). The old "Chi tiết" at the row end is gone (the fold moved below, next section). The separator runs the width of the card body (inside the bubble padding).
Luật: `lead-freeze-on-failure` (Thử lại / Tiếp quản / Bỏ qua), `red-budget-links-foreground`, `row-control-clearance`.
Grammar: `Divider semantics="presentation"`, `Cluster`, `Button intent="neutral" size="sm"` (no icon).

## Chi tiết kỹ thuật (đóng mặc định) và dấu vết trả lời
Vì sao: the facts flagged `technical` carry raw engine codes (`GRAPH_NODES_TOOL_NOT_GRANTED`, `chatbot.front-desk`), so they stay folded under "Chi tiết kỹ thuật" at the bottom of the card (drawing 2026-11-13), closed by default; opened, they are a bordered list inside the card with full-width dividers, name muted at the start and value at the end (surface in surface, never a grey box). No technical fact: no fold. The reply trace (none yet on this card) is the same bordered list, one row per reply: the words, then "<tên> trả lời · <giờ>" at 12 muted.
Luật: `nivo-surface-layering` (owner: every list inside the card is a bordered card list), `surfacecard-select-subtitle` (full-width dividers), `type-scale-14-12`.
Grammar: `Disclosure kind="quiet"` (its own chevron, never a typed "▸"), `SurfaceCard kind="list" layout="keyValue"` and `kind="list"` rows with a 12 `description` (`frame/SurfaceCard/index.d.ts`, `surfaceCardData.d.ts` `ListData`); nested in the white message it draws itself bordered without shadow.

## Ảnh phase 2 phải chụp lại (mỗi ảnh cần dữ liệu gì), 1440 / 1920 / 390
Dev has no stop with `technical` facts and no preview: seed or replay a `workflow.stopped` message for each.
1. Mở, AI hỏi (`ai_report`, open): reason + question + 2 worded facts + 1 `technical` fact + 2 suggestions; check the head "Workflow dừng · <wf> › <step>", the bold question, the list with "Lần dừng", the "Gợi ý" label, the answer box, the decision row, the closed fold.
2. Cùng thẻ, mở "Chi tiết kỹ thuật": the technical rows.
3. NIVO báo (`ai_error`): no suggestions, chip "NIVO báo".
4. Đã trả lời / đã xong: no controls, trace row kept.
5. Xin quyền (approval): own headline, own lines, no "Lần dừng" row.
6. 390 px with a long fact value and a long workflow / step title (the head wraps, nothing overflows).
7. With a preview: BLOCKED until ENGINE-FIX emits `preview` and a package registers a preview kind; shoot then.
