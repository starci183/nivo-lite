# Sales › Bàn làm việc › Cần chú ý

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

## Card "Cần chú ý" (rỗng)
Card có nhãn, biểu tượng, câu "Không có việc nào cần bạn chú ý" và dòng gợi ý.

Vì sao: Việc cần chú ý là card nên trạng thái rỗng cũng là card đúng chỗ đó; có việc thì danh sách thay vào chính card này.

Luật: `surfacecard-zones-api`, `ui-laws` (Cần chú ý items are cards).

Grammar: `SurfaceCard` + `EmptyNotice frame="frameless"`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Card bảng "Đơn gần đây"
Một SurfaceCard: tiêu đề + chip đếm ngay sau nhãn, ô tìm, tab lọc có chip đếm, bảng, phân trang. Năm dòng mỗi trang; ô Tổng trống hiện "—". Mã đơn, Tổng, Trạng thái là fit; Món là cột fill, cắt bằng dấu ba chấm; Khách là cột cố định 200px có cắt (xem Grammar/blocks-core: nên là fit hoặc fill). Cột ngắn là fit + một dòng, không xuống dòng; chỉ cột fill cắt bằng dấu ba chấm. Bảng là thẻ trắng kiểu danh sách (Grammar 0.37.8+: không khung xám). Đã soi 1440/1920/390 với Grammar 0.37.17.

Vì sao: Cùng một tập dữ liệu (tìm + lọc + bảng + phân trang) là MỘT card; mỗi vùng header là một hàng riêng ngăn bằng divider do shell vẽ. Dưới 768 cột phụ gập vào dòng.

Luật: `surfacecard-zones-api` (Same domain = one card), `table-heroui-native-section-head`, contexts/ui/components/card.md HEADER-ZONES-DIVIDERS, CARDS-FOR-COLLECTIONS.

Grammar: `SurfaceCard kind="table"` `label`, `count`, `headers=[{kind:"search"},{kind:"filter"}]`, `footers=[{kind:"paging"}]`, cột `width`/`truncate`/`hideBelow`/`priority`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

