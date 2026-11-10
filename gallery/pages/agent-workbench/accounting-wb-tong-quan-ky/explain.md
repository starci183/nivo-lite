# Kế toán › Bàn làm việc › Tổng quan kỳ

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
Thu nhập tháng này, Phải thu, Tiền về chưa khớp, Tuổi nợ (một SurfaceCard figures như các tab khác).

Vì sao: Dải chỉ số là một card riêng, một nội dung (figures); số 20, nhãn mờ; ở 390 Grammar xếp lại ô (hàng hai ô là việc của Grammar, app không tự đặt breakpoint).

Luật: `surfacecard-zones-api` (figures wrap), `type-scale-14-12`.

Grammar: `SurfaceCard kind="figures"`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts` (Figure).

## Card "Sắp đến hạn · 30 ngày tới"
Danh sách hạn thuế với chip "Còn N ngày"; câu "Chỉ liệt kê hạn thuế…" là note của card kèm liên kết.

Vì sao: Worklist có giới hạn trên nền hồng là SurfaceCard list; chú thích về dữ liệu của card đứng dưới card (note 12 mờ), không phải khối riêng.

Luật: `surfacecard-zones-api`, `table-heroui-native-section-head`.

Grammar: `SurfaceCard kind="list"` `note`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Card "Thu nhập theo tuần"
Công tắc Tháng này / Tháng trước và biểu đồ cột; chú thích dưới card.

Vì sao: Công tắc đổi kỳ của cùng dữ liệu là primary tab (viên thuốc) trong header zone `switch`; chú thích là note 12 mờ dưới card.

Luật: `surfacecard-zones-api` (primary vs secondary tabs).

Grammar: `SurfaceCard headers=[{kind:"switch"}]` + `note`, `BarChart`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

