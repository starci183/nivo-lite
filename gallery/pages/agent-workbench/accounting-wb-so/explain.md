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

Vì sao: Một card bảng; công tắc kỳ là primary tab; dưới 768 cột Thu/Chi gập vào dòng. Cột ngắn (Thu, Chi, Số dư, Ngày, Số tiền, Trạng thái) là fit + một dòng, không xuống dòng; chỉ cột fill (Diễn giải / Nội dung) cắt bằng dấu ba chấm, đã thấy ở các dòng mã chuyển khoản dài. Bảng là thẻ trắng kiểu danh sách (Grammar 0.37.8+, không khung xám). Đã soi 1440/1920/390 với Grammar 0.37.17.

Luật: `surfacecard-zones-api`, `table-heroui-native-section-head`.

Grammar: `SurfaceCard kind="table"` `groups`, `headers=[{kind:"switch"}]`; `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts` (TableGroupData).

## Aside "Tài khoản đã gắn" (chỉ đọc)
Vì sao: Một dòng cho mỗi TÀI KHOẢN đã gắn vào agent ("SePay · •••• 9999"), logo nhà cung cấp, dòng 12 mờ liệt kê khả năng đang bật kèm chế độ ("(Tự động)", "(Hỏi)"); đầu khung có tên và đúng một liên kết "Quyền →"; không có nút, không "Tự làm", không "Cấp quyền" vì việc cấp quyền nằm ở tab Quyền. Khung viền 1px, bo góc, không bóng. Chỉ đọc theo bản vẽ quyen-tai-khoan-2 (khung 3). Khác bản vẽ (dữ liệu blocks-core, đã ghi ở LG-REQUESTS "UX/UI"): tên dòng còn lặp tên nhà cung cấp và dòng mô tả bị cắt trước phần chế độ.

Luật: `pink-page-surface-rule` (aside trắng), `surfacecard-select-subtitle` (dòng phụ 12 mờ), `table-heroui-native-section-head` (đầu nhóm: nhãn trái, một liên kết "→" phải).

Grammar: `SurfaceCard kind="list"` (viền 1px, không bóng, 0.37.24) trong `Pane surface`, `Link variant="head"`; node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts. Khối do blocks-core vẽ (`ConnectionsRegion`), không phải fe.
