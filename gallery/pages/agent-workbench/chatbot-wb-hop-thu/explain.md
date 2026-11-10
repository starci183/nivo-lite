# Chatbot › Bàn làm việc › Hộp thư

## Dải đầu trang (breadcrumb, tên agent, tab, sub-tab)
Breadcrumb, tên agent với chip trạng thái, hàng tab trang và hàng sub-tab của Bàn làm việc.

Vì sao: Dải đầu nằm trên nền trắng, căn trái, không cuộn mất; sub-tab là lớp 2 nằm trong dải đầu, không bao giờ nằm trên nền hồng.

Luật: `page-header-left-sublabel-xs`, `pink-page-surface-rule`.

Grammar: `Page` header + `Page header.subTabs`, `Tabs` secondary (gạch chân); `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`.

## Ba pane, một hàng đầu chung
Hộp thư (chip đếm) | cuộc trò chuyện (tên khách, kênh, tiếp quản, Thông tin) | "Agent trả lời từ" với nút đóng.

Vì sao: Workspace là các pane chia bởi divider; pane bên là trắng, tràn chiều cao; ba đầu pane trên một hàng chung; aside đóng bằng Pane head sticky.

Luật: `ui-laws` (Layout B), `pink-page-surface-rule`.

Grammar: `PaneGrid` + `Pane surface` + `PaneHeader`, `Pane head`; `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts`.

## Danh sách hội thoại
Nhãn Hộp thư + chip, ô tìm, tab lọc Tất cả / Cần người / Hôm nay có chip đếm, rồi từng hội thoại với avatar mầm, tên, câu cuối, thời gian, trạng thái.

Vì sao: Thứ tự vùng đầu là nhãn | ô tìm | tab lọc; danh sách trong pane trắng không phải card; mỗi dòng chỉ còn một chip trạng thái để câu cuối có chỗ.

Luật: `surfacecard-zones-api` (header zones order), `ui-laws` (Tab counts).

Grammar: `Tabs kind="filter"`, `SearchField`, `ListBox`; `node_modules/@starci/grammar/dist/core/composite/Tabs`.

## Luồng chat và ô soạn
Bong bóng khách (trắng) và agent (đỏ) theo nhóm người gửi; ô soạn 2 dòng với nút gửi.

Vì sao: Chỉ luồng tin cuộn; đầu chat và ô soạn cố định ở đáy pane.

Luật: `ui-laws` (Chat), `type-scale-14-12`.

Grammar: `MessageBubble`, `Pane footer` / `PaneSection scroll role="log"`; `node_modules/@starci/grammar/dist/core/composite/MessageBubble/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`.

## Aside "Agent trả lời từ"
Nhóm Agent (Chatbot, @chatbot), Hội thoại (Khách, Kênh, Giai đoạn), liên kết Mở hồ sơ khách.

Vì sao: Aside luôn sát phải và không rỗng: hội thoại đầu tiên tự mở trên desktop; mỗi nhóm là SurfaceCard viền với khóa mờ, giá trị thường; không có câu giải thích lơ lửng.

Luật: `pink-page-surface-rule`, `surfacecard-zones-api`, contexts/ui/components/card.md WHITE-LIST-BORDERED-CARD.

Grammar: `Pane head`, `SurfaceCard kind="list" layout="keyValue"`; `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

