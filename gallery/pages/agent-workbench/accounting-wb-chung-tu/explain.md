# Kế toán › Bàn làm việc › Chứng từ

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

## Dải số liệu
Thu nhập, Phải thu, Chi phí, Cần xem lại: số chứng từ theo trạng thái (đọc tiền cần thêm tổng vào read của BE).

Vì sao: Dải chỉ số là một card riêng, một nội dung (figures); số 20, nhãn mờ; ở 390 Grammar xếp lại ô (hàng hai ô là việc của Grammar, app không tự đặt breakpoint).

Luật: `surfacecard-zones-api` (figures wrap), `type-scale-14-12`.

Grammar: `SurfaceCard kind="figures"`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts` (Figure).

## Card bảng "Chứng từ"
Một SurfaceCard: tiêu đề + chip đếm ngay sau nhãn, ô tìm, tab lọc có chip đếm, bảng, phân trang. Cột Ngày, Nội dung gọn (mã đơn · khách, nội dung gốc nằm ở chi tiết), Số tiền, Trạng thái; bấm dòng mở chi tiết bên phải. Quy tắc kế toán là sub-tab thứ năm nên không còn liên kết lơ lửng.

Vì sao: Cùng một tập dữ liệu (tìm + lọc + bảng + phân trang) là MỘT card; mỗi vùng header là một hàng riêng ngăn bằng divider do shell vẽ. Dưới 768 cột phụ gập vào dòng.

Luật: `surfacecard-zones-api` (Same domain = one card), `table-heroui-native-section-head`, contexts/ui/components/card.md HEADER-ZONES-DIVIDERS, CARDS-FOR-COLLECTIONS.

Grammar: `SurfaceCard kind="table"` `label`, `count`, `headers=[{kind:"search"},{kind:"filter"}]`, `footers=[{kind:"paging"}]`, cột `width`/`truncate`/`hideBelow`/`priority`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Aside mặc định (chưa chọn dòng)
Kết nối và Tri thức đang dùng.

Vì sao: Aside luôn có nội dung khi chưa chọn chứng từ.

Luật: `pink-page-surface-rule`.

Grammar: `Pane surface`; `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`.

