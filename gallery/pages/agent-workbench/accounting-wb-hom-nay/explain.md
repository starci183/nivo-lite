# Kế toán › Bàn làm việc › Hôm nay

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
Tiền về hôm nay, Đã khớp đơn, Chưa khớp, Chờ bạn.

Vì sao: Dải chỉ số là một card riêng, một nội dung (figures); số 20, nhãn mờ; ở 390 Grammar xếp lại ô (hàng hai ô là việc của Grammar, app không tự đặt breakpoint).

Luật: `surfacecard-zones-api` (figures wrap), `type-scale-14-12`.

Grammar: `SurfaceCard kind="figures"`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts` (Figure).

## Card "Cần bạn"
Danh sách khoản chưa khớp với nút Khớp / Thêm; khi rỗng card giữ nhãn và nói "không có khoản nào chờ" bên trong.

Vì sao: Việc cần chú ý là card nên rỗng cũng là card; liên kết điều hướng ở đầu khối là "→".

Luật: `surfacecard-zones-api`, `table-heroui-native-section-head`.

Grammar: `SurfaceCard kind="list"` `labelEnd` = `Link variant="head"`, `EmptyNotice`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Card "Việc gần đây"
Danh sách việc agent vừa làm với chip trạng thái; liên kết "Xem cả ở Công việc →" ở đầu khối.

Vì sao: Footer link chuyển lên đầu khối thành "→".

Luật: `table-heroui-native-section-head`.

Grammar: `SurfaceCard kind="list"` `labelEnd`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Aside Kết nối / Tri thức đang dùng
Hai nhóm bên phải: kết nối và tri thức agent đang dùng, khi chưa chọn dòng.

Vì sao: Aside là chrome trắng sát phải, luôn có nội dung; mỗi nhóm có đầu section với liên kết "→".

Luật: `pink-page-surface-rule`, `table-heroui-native-section-head`.

Grammar: `Pane surface`, `SurfaceCard kind="list"`, `Link variant="head"`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

