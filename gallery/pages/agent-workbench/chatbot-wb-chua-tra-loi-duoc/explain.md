# Chatbot › Bàn làm việc › Chưa trả lời được

## Dải đầu trang (breadcrumb, tên agent, tab, sub-tab)
Breadcrumb, tên agent với chip trạng thái, hàng tab trang và hàng sub-tab của Bàn làm việc.

Vì sao: Dải đầu nằm trên nền trắng, căn trái, không cuộn mất; sub-tab là lớp 2 nằm trong dải đầu, không bao giờ nằm trên nền hồng.

Luật: `page-header-left-sublabel-xs`, `pink-page-surface-rule`.

Grammar: `Page` header + `Page header.subTabs`, `Tabs` secondary (gạch chân); `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`.

## Nền hồng giữa (well)
Vùng giữa màu hồng chứa các card nổi, cuộn riêng.

Vì sao: Chỉ vùng giữa là nền hồng; chrome (sidebar, header, aside) là bề mặt trắng; card trên hồng có bóng, không viền.

Luật: `pink-page-surface-rule`, `nivo-surface-layering`.

Grammar: `Pane` content="cards", `PaneGrid`; `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`.

## Chip đếm trên tab
Tab "Chưa trả lời được" mang chip đếm số hội thoại cần người.

Vì sao: Tab trang ẩn số 0, chip hồng chỉ khi có việc chờ chủ: số lấy từ cùng read đếm của hộp thư.

Luật: `surfacecard-zones-api` (tab counts), `ui-laws`.

Grammar: `Tabs items {label, count, isAttention}`; `node_modules/@starci/grammar/dist/core/composite/Tabs`.

## Card bảng "Chưa trả lời được" (rỗng hoặc có dữ liệu)
Card giữ nhãn; rỗng thì EmptyNotice nằm trong card, có dữ liệu thì bảng khách với chip trạng thái.

Vì sao: Trạng thái rỗng nằm trong khối, card không đến rồi đi; nội dung cùng bảng Khách đang xử lý.

Luật: `surfacecard-zones-api`, `table-heroui-native-section-head`.

Grammar: `SurfaceCard kind="table"` + `EmptyNotice frame="frameless"`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

