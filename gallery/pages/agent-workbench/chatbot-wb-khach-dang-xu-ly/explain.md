# Chatbot › Bàn làm việc › Khách đang xử lý

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
Bốn số: hội thoại hôm nay, tự xử lý, bàn giao, người đang xử lý.

Vì sao: Dải chỉ số là một card riêng, một nội dung (figures); số 20, nhãn mờ; ở 390 Grammar xếp lại ô (hàng hai ô là việc của Grammar, app không tự đặt breakpoint).

Luật: `surfacecard-zones-api` (figures wrap), `type-scale-14-12`.

Grammar: `SurfaceCard kind="figures"`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts` (Figure).

## Card bảng "Khách đang xử lý"
Một SurfaceCard: tiêu đề + chip đếm ngay sau nhãn, ô tìm, tab lọc có chip đếm, bảng, phân trang. Cột Khách (tên trên, câu cuối dưới), Trạng thái (chip chấm), Kênh; hai cột sau gập vào dòng dưới 768.

Vì sao: Cùng một tập dữ liệu (tìm + lọc + bảng + phân trang) là MỘT card; mỗi vùng header là một hàng riêng ngăn bằng divider do shell vẽ. Dưới 768 cột phụ gập vào dòng.

Luật: `surfacecard-zones-api` (Same domain = one card), `table-heroui-native-section-head`, contexts/ui/components/card.md HEADER-ZONES-DIVIDERS, CARDS-FOR-COLLECTIONS.

Grammar: `SurfaceCard kind="table"` `label`, `count`, `headers=[{kind:"search"},{kind:"filter"}]`, `footers=[{kind:"paging"}]`, cột `width`/`truncate`/`hideBelow`/`priority`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

