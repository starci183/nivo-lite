# Sales › Bàn làm việc › Đơn hàng

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

## Card bảng "Đơn hàng"
Một SurfaceCard: tiêu đề + chip đếm ngay sau nhãn, ô tìm, tab lọc có chip đếm, bảng, phân trang. Tab lọc Tất cả, Nháp, Đã xác nhận, Đã xuất hóa đơn, Đã thanh toán, Đã hủy, Lỗi hệ thống; chip đếm xám vì chưa trạng thái nào là việc chờ chủ; ô Tổng trống hiện "—" (đơn nháp chưa có tổng).

Vì sao: Cùng một tập dữ liệu (tìm + lọc + bảng + phân trang) là MỘT card; mỗi vùng header là một hàng riêng ngăn bằng divider do shell vẽ. Dưới 768 cột phụ gập vào dòng.

Luật: `surfacecard-zones-api` (Same domain = one card), `table-heroui-native-section-head`, contexts/ui/components/card.md HEADER-ZONES-DIVIDERS, CARDS-FOR-COLLECTIONS.

Grammar: `SurfaceCard kind="table"` `label`, `count`, `headers=[{kind:"search"},{kind:"filter"}]`, `footers=[{kind:"paging"}]`, cột `width`/`truncate`/`hideBelow`/`priority`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

