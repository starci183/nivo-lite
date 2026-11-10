# Sales › Bàn làm việc › Tiến trình bán

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

## Bảng tiến trình (Board)
Nhãn "Tiến trình bán" + chip đếm, ô tìm, các cột giai đoạn với thẻ khách.

Vì sao: Danh sách khách theo giai đoạn là một khối; chip đếm đứng ngay sau nhãn. Mũi tên mở thẻ do Board của Grammar đặt.

Luật: `table-heroui-native-section-head`.

Grammar: `Section count`, `Board`; `node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/Board/index.d.ts`.

