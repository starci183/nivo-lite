# Kế toán › Bàn làm việc › Sổ

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
Số dư đầu kỳ, Thu, Chi, Số dư cuối kỳ.

Vì sao: Dải chỉ số là một card riêng, một nội dung (figures); số 20, nhãn mờ; ở 390 Grammar xếp lại ô (hàng hai ô là việc của Grammar, app không tự đặt breakpoint).

Luật: `surfacecard-zones-api` (figures wrap), `type-scale-14-12`.

Grammar: `SurfaceCard kind="figures"`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts` (Figure).

## Card "Sổ quỹ"
Bảng nhóm theo ngày (hàng nhóm có số dư cuối ngày), công tắc Tháng này / Tháng trước.

Vì sao: Một card bảng; công tắc kỳ là primary tab; dưới 768 cột Thu/Chi gập vào dòng.

Luật: `surfacecard-zones-api`, `table-heroui-native-section-head`.

Grammar: `SurfaceCard kind="table"` `groups`, `headers=[{kind:"switch"}]`; `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts` (TableGroupData).

