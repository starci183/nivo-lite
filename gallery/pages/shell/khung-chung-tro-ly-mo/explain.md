---
title: Ngăn kéo Trợ lý NIVO đang mở (Tổng quan)
route: /workspaces/<ws>/overview (mọi trang trong console)
area: shell
---
Cùng khung console với `shell/khung-chung`. Công tắc "Hiện trợ lý NIVO" trong menu avatar đã bật (lưu theo trình duyệt), nút trợ lý nổi góc dưới phải đã bấm và ngăn kéo bên phải mở trên trang Tổng quan; trang phía sau bị phủ mờ. Chụp từ Next dev server, chỉ đọc (không gửi gì).

## Ngăn kéo là một khung chat (đầu, thread, ô nhập)
Vì sao: ngăn kéo chứa một chat, nên cả khung (đầu + thread + chân ô nhập) là `--background` (hồng) dù ngăn kéo nằm đè lên trang nào; đo trong trang: thread `role="log"` nền `--background`, bong bóng phẳng không bóng đổ không viền. Chỉ thread cuộn, thread mở ở tin mới nhất (tin chào nằm sát chân thread).
Luật: DNA-COMMON-CHAT-FRAME (khung chat là `--background` ở mọi trang kể cả ngăn kéo), DNA-COMMON-CHAT-FRAME-SCROLL (chỉ thread cuộn), `chat-surfaces`.
Grammar: `Drawer placement="right"` (`frame/Drawer/index.d.ts`) chứa `Pane content="chat"` (Grammar 0.37.33, `frame/PaneGrid/index.d.ts`); app block `GuideBubble` (`drawer.tsx`).

## Đầu ngăn kéo: dấu NIVO, "Trợ lý NIVO", mô tả, phím tắt, nút đóng
Vì sao: một hàng đầu trên nền `--background`: dấu trợ lý, tên 14/500, mô tả 12 xám "Tìm trang, việc, khách · miễn phí" cùng phím tắt `Ctrl K`, nút tròn đóng ở cuối hàng.
Luật: `type-scale-14-12`, DNA-COMMON-CHAT-FRAME (đầu thuộc khung chat), `page-header-left-sublabel-xs` (đầu canh trái).
Grammar: `PaneHeader title description mark actions` (`composite/PaneHeader/index.d.ts`), `IconButton intent="neutral"` (`leaf/IconButton/index.d.ts`).

## Tin của trợ lý và thẻ gợi ý
Vì sao: lời chào là bong bóng trắng phẳng (lời của trợ lý); ba việc nên làm là MỘT danh sách viền bên trong thẻ, mỗi hàng một dòng chữ thường kèm mũi tên, bấm cả hàng để chạy; đó là mẫu gợi ý trong thẻ.
Luật: `chat-surfaces` (gợi ý trong thẻ = danh sách viền, mỗi hàng một dòng), `chat-surfaces` (bong bóng phẳng), `type-scale-14-12`.
Grammar: `MessageBubble` (`composite/MessageBubble/index.d.ts`), `SurfaceCard kind="list" layout="suggestions"` (`surfaceCardData.d.ts` `ListData`, DNA-COMMON-CARD-SUGGESTIONS).

## Chip gợi ý cạnh ô nhập
Vì sao: bốn câu hỏi nhanh là nút trung tính cỡ sm dạng viên, xuống dòng khi hết chỗ, không có icon: một mẫu gợi ý duy nhất.
Luật: `suggestion-button-sm`, `page-header-left-sublabel-xs` (nút sm không icon).
Grammar: `Button intent="neutral" size="sm"` trong `Cluster` (`leaf/Button/index.d.ts`, `frame/Cluster/index.d.ts`).

## Ô nhập "Tìm trang, việc, khách, tài liệu..."
Vì sao: chân của khung chat là một ô tìm trắng trên nền hồng, ô đang có tiêu điểm nên có viền nhấn; một dải kẻ 1px ngăn thread với chân. Ở trợ lý đây là ô tìm (không phải ô soạn nhiều dòng).
Luật: DNA-COMMON-CHAT-FRAME (chân khung chat `--background`, ô nhập trắng), `owner-colors-exact`.
Grammar: `TextField` search trong `Pane footer` (`branch/TextField/index.d.ts`, `frame/PaneGrid/index.d.ts`).

## Lớp phủ mờ và trang phía sau
Vì sao: ngăn kéo là lớp phủ trên bề mặt: phần còn lại của trang (thanh trên, sidebar, trang Tổng quan) giữ luật cũ của nó và chỉ bị phủ mờ để ngăn kéo nổi lên.
Luật: `nivo-surface-layering` (lớp phủ nằm trên surface).
Grammar: `Drawer` (`frame/Drawer/index.d.ts`).

## Điện thoại 390
Vì sao: ngăn kéo choán cả chiều ngang, đầu giữ nút đóng, thread cuộn giữa đầu và chân, chip gợi ý xuống dòng. CHƯA ĐẠT: ở 390 mũi tên của mỗi hàng gợi ý trong thẻ rơi xuống dòng dưới chữ thay vì nằm cuối hàng (lỗi bố cục `SurfaceCard layout="suggestions"` ở chiều hẹp, thuộc Grammar, báo cáo).
Luật: `page-header-left-sublabel-xs`, `suggestion-button-sm`.
Grammar: `Drawer`, `Cluster`.
