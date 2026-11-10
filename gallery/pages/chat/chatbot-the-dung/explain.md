---
title: Trò chuyện / Chatbot (thẻ quy trình đang dừng)
route: /workspaces/<ws>/chat?room=<id>
area: chat
---
Route `/workspaces/<ws>/chat?room=<id>`, the direct room with the Chatbot agent, scrolled to a live typed `workflow.stopped` card (`ChatMessageType.stop`, state `open`, kind `ai_report`, revision 0 = an old-engine stop read through the typed field). Shots `1440.png`, `1920.png`, `390.png` from the Next dev server, read only (no decision was pressed). The rest of the page (rooms pane, room head, composer) is explained in `chat/agent-sales`. Approved drawing: `lanes/drawings/stop-card-2.png` (card 1).

## Thẻ dừng: tác giả, dòng phụ, khung thẻ
Vì sao: one card per stop, rewritten in place (same message id). The agent name and the muted 12 line "<quy trình> · <bước> · <giờ>[ · lần N]" stand above the card like every other message of the thread, the agent mark beside it; the card face is the surface card at the wide chat measure. Here the line reads "front-desk · answer" because the old engine sends keys as titles (engine debt, not drawn by the web).
Luật: `type-scale-14-12` (meta 12 muted, text 14), `chat-surfaces` (the thread is on `--background`; a message of an agent is flat `--surface` white: no shadow, no border; it is a message, not a card), `blocks-core-pure-edge-to-chat` (the engine reports to /chat), `lead-freeze-on-failure`.
Grammar: `MessageCard measure="wide" author avatar title chip meta body` (`composite/MessageCard/index.d.ts`, 0.37.30: the content column fills the card, so the nested lists and the composer span it); app composite `components/composites/TeamChatStopCard`.

## Tiêu đề + chip trạng thái
Vì sao: the engine's headline at weight 600 with the state chip at the row end. Chip words are the web's: open + AI = "Cần bạn quyết" (accent), open + NIVO = "NIVO báo" (neutral), "Đã trả lời" / "Đã xong" (success), "Đã bỏ qua" / "Hết hạn" (neutral), after a take-over "Bạn đang tiếp quản" (warning). Tones are Grammar Badge tones, no new colour.
Luật: `owner-colors-exact`, `type-scale-14-12`.
Grammar: `MessageCard title` + `chip={<Badge tone>}` beside it, `Badge tone` (`leaf/Badge/index.d.ts`, built-in tones).

## Lời nhắn và câu hỏi
Vì sao: the engine's `message`, then its `question`, plain 14 text; raw facts never stand here.
Luật: `type-scale-14-12`, `unhandled-case-tells-customer` (words come from the engine/AI, not coded).
Grammar: `Text` (`leaf/Text/index.d.ts`).

## Gợi ý trả lời
Vì sao: one press on a row sends that text as the answer (`decideRunStop action answer`). The suggestions inside the card are one bordered list, a plain-text row per suggestion with a chevron (surface in surface); the pills by the composer stay `Button sm`.
Luật: `chat-surfaces` (in-card suggestions = bordered list), `suggestion-button-sm` (composer chips only).
Grammar: `SurfaceCard kind="list" layout="suggestions"` with `onPress` rows (0.37.31, `surfaceCardData.d.ts` `ListData`, law DNA-COMMON-CARD-SUGGESTIONS).

## Ô trả lời + Gửi
Vì sao: drawn only when `needs.answer`; a composer of 2 to 6 lines (Enter sends) and the one red primary "Gửi", the only red CTA of the card and the only button with an icon. Disabled until there is text. Placeholder "Trả lời cho AI..." (AI report) or "Nhắn thêm ngữ cảnh cho AI..." (AI error).
Luật: `red-budget-links-foreground` (one red CTA), `page-header-left-sublabel-xs` (composer min 2 rows), `verify-against-visualize` (only the primary carries an icon).
Grammar: `Textarea onSubmitShortcut isLabelHidden` (`branch/Textarea/index.d.ts`, `COMPOSER_MIN_ROWS`), `Button intent="commit" startGlyph="send"`.

## Hàng quyết định: Thử lại / Tiếp quản / Bỏ qua, "Chi tiết" cuối hàng
Vì sao: under a separator, only the decisions `needs.decisions` lists, as neutral sm buttons (decide door `decideRunStop`; toast "Đã xử lý" / "Đang áp dụng", then the thread is read again). "Chi tiết" at the row end opens the engine facts; it is a standalone text action in the foreground colour, not red. The separator runs the width of the card body (inside the bubble padding).
Luật: `lead-freeze-on-failure` (Thử lại / Tiếp quản / Bỏ qua), `red-budget-links-foreground`, `row-control-clearance`.
Grammar: `Divider semantics="presentation"`, `Cluster justify="between"`, `Button intent="neutral" size="sm"`, `TextAction appearance="plain" size="sm"` (`leaf/TextAction/index.d.ts`).

## Chi tiết (đóng mặc định) và dấu vết trả lời
Vì sao: facts carry raw engine codes (`ai_confused`, `chatbot.front-desk`), so they stay folded; opened, they are a bordered list inside the card with full-width dividers, name muted at the start and value at the end (surface in surface, never a grey box). The reply trace (none yet on this card) is the same bordered list, one row per reply: the words, then "<tên> trả lời · <giờ>" at 12 muted.
Luật: `nivo-surface-layering` (owner: every list inside the card is a bordered card list), `surfacecard-select-subtitle` (full-width dividers), `type-scale-14-12`.
Grammar: `SurfaceCard kind="list" layout="keyValue"` and `kind="list"` rows with a 12 `description` (`frame/SurfaceCard/index.d.ts`, `surfaceCardData.d.ts` `ListData`); nested in the white message it draws itself bordered without shadow.
