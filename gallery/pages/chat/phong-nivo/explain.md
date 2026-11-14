---
title: Trò chuyện / Phòng NIVO (việc nền bị dừng)
route: /workspaces/<ws>/chat?room=<id>
area: chat
---
Route `/workspaces/<ws>/chat?room=<id>`, phòng NIVO của chủ tiệm. Bản vẽ: `truth-graph-flows.png` vùng E. Phòng và 8 thẻ trong shot là DỮ LIỆU GIẢ (mocked: dev chỉ có thẻ của việc suy ra chính sách); mỗi thẻ là một cặp việc / lý do mà backend có thể gửi (`background.stopped`). Mọi chữ do web ghép từ mã (không lấy chữ của backend); mã lạ rơi về câu chung.

## Phòng NIVO trong danh sách và đầu phòng
Vì sao: phòng riêng của NIVO mang dấu NIVO, không phải của người hay agent; dòng xem trước lấy tiêu đề của thẻ cuối cùng (đúng việc, đúng lý do), không phải mã thô.
Luật: `chat-surfaces`, `type-scale-14-12`.
Grammar: `ListBoxItem` (`branch/ListBox/index.d.ts`), `PaneHeader` `mark`; code `hooks/teamChat/teamChat.shared.ts` (`previewOf`).

## Thẻ việc nền: tiêu đề gọi tên việc ("Second Brain đã đầy", "Chưa đồng bộ được chỉ mục tìm kiếm", "Chưa đọc xong sự thật của tài liệu", "Chưa suy ra được chính sách")
Vì sao: tiêu đề nói đúng việc nào dừng (tài liệu + `ceiling` = đã đầy; tài liệu còn lại = chưa đọc xong; đồng bộ vector = chỉ mục tìm kiếm; suy chính sách giữ tiêu đề cũ). Chip "NIVO báo" là nhãn trung tính không chấm (đây là kết quả, không phải việc đang chạy).
Luật: `badge-dot-or-not`, `chat-surfaces`, `type-scale-14-12`.
Grammar: `MessageCard` `title` `chip` `author` `meta` (`composite/MessageCard/index.d.ts`); `Badge tone="neutral"`; composite `TeamChatBackgroundStoppedCard`.

## Câu giải thích theo lý do (model / credits / gave_up / ceiling)
Vì sao: một câu ngắn cho mỗi cặp việc + lý do, không có số (thẻ không mang số đếm): hết credit thì nói NIVO sẽ tiếp tục khi có credit; AI không đọc được sau ba lần thử thì nói những gì đã đọc vẫn dùng; chạm trần thì nói phần còn lại đang chờ trong Kiến thức; chỉ mục tìm kiếm thì nói tạm dùng tìm theo chữ và NIVO tự thử lại.
Luật: `unhandled-case-tells-customer` (không bỏ qua im lặng), `type-scale-14-12`.
Grammar: `Text` (`leaf/Text/index.d.ts`) trong `Stack gap="row"`.

## Nút trung tính sm tới nơi xử lý ("Mở tab Chính sách", "Mở Kiến thức") và "Chi tiết ›"
Vì sao: thẻ chỉ báo, không có nút quyết định; một nút trung tính sm (không icon) dẫn tới chỗ thử lại: tab Chính sách cho việc suy ra chính sách, trang Tài liệu của Second Brain cho tài liệu và chỉ mục. "Chi tiết ›" ở cuối hàng mở danh sách mã thô (việc, lý do, từ lúc).
Luật: `suggestion-button-sm`, `page-header-left-sublabel-xs` (nút sm không icon), `red-budget-links-foreground` (không đỏ, link thường là màu chữ).
Grammar: `Button intent="neutral" size="sm" href`; `TextAction appearance="plain"` (`leaf/TextAction`); `SurfaceCard kind="list" layout="keyValue"`.

## Ô nhập thay bằng một dòng chỉ-đọc
Vì sao: không ai trả lời trong phòng NIVO (backend từ chối gửi), nên không vẽ ô nhập mà vẽ một dòng muted chỉ đường tới agent. Quyền gửi lấy từ ghế của CHÍNH người xem (`mayPost`), `withNivo` chỉ là gợi ý.
Luật: `chat-surfaces`, `type-scale-14-12`.
Grammar: `PaneSection as="footer"` qua frame `ChatComposerBand`; code `hooks/teamChat/useTeamChatRoomView.ts` (`canPostIn`).
