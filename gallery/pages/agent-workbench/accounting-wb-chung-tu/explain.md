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
Một SurfaceCard: tiêu đề + chip đếm ngay sau nhãn, ô tìm, tab lọc có chip đếm, bảng, phân trang. Cột Ngày, Nội dung gọn (mã đơn · khách, nội dung gốc nằm ở chi tiết), Số tiền, Trạng thái; bấm dòng mở chi tiết bên phải. Cột ngắn (Thu, Chi, Số dư, Ngày, Số tiền, Trạng thái) là fit + một dòng, không xuống dòng; chỉ cột fill (Diễn giải / Nội dung) cắt bằng dấu ba chấm, đã thấy ở các dòng mã chuyển khoản dài. Bảng là thẻ trắng kiểu danh sách (Grammar 0.37.8+, không khung xám). Đã soi 1440/1920/390 với Grammar 0.37.17. Lỗi còn mở ở 390 (Grammar, đầu mục có nhãn + chip đếm): chip rơi xuống dòng dưới và nhãn bị cắt nửa trên (xem 390.png). Quy tắc kế toán là sub-tab thứ năm nên không còn liên kết lơ lửng.

Vì sao: Cùng một tập dữ liệu (tìm + lọc + bảng + phân trang) là MỘT card; mỗi vùng header là một hàng riêng ngăn bằng divider do shell vẽ. Dưới 768 cột phụ gập vào dòng.

Luật: `surfacecard-zones-api` (Same domain = one card), `table-heroui-native-section-head`, contexts/ui/components/card.md HEADER-ZONES-DIVIDERS, CARDS-FOR-COLLECTIONS.

Grammar: `SurfaceCard kind="table"` `label`, `count`, `headers=[{kind:"search"},{kind:"filter"}]`, `footers=[{kind:"paging"}]`, cột `width`/`truncate`/`hideBelow`/`priority`; `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Aside mặc định (chưa chọn dòng)
Kết nối và Tri thức đang dùng.

Vì sao: Aside luôn có nội dung khi chưa chọn chứng từ.

Luật: `pink-page-surface-rule`.

Grammar: `Pane surface`; `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`.

## Aside "Tài khoản đã gắn" (chỉ đọc)
Vì sao: Một dòng cho mỗi TÀI KHOẢN đã gắn vào agent ("SePay · •••• 9999"), logo nhà cung cấp, dòng 12 mờ liệt kê khả năng đang bật kèm chế độ ("(Tự động)", "(Hỏi)"); đầu khung có tên và đúng một liên kết "Quyền →"; không có nút, không "Tự làm", không "Cấp quyền" vì việc cấp quyền nằm ở tab Quyền. Khung viền 1px, bo góc, không bóng. Chỉ đọc theo bản vẽ quyen-tai-khoan-2 (khung 3). Khác bản vẽ (dữ liệu blocks-core, đã ghi ở LG-REQUESTS "UX/UI"): tên dòng còn lặp tên nhà cung cấp và dòng mô tả bị cắt trước phần chế độ.

Luật: `pink-page-surface-rule` (aside trắng), `surfacecard-select-subtitle` (dòng phụ 12 mờ), `table-heroui-native-section-head` (đầu nhóm: nhãn trái, một liên kết "→" phải).

Grammar: `SurfaceCard kind="list"` (viền 1px, không bóng, 0.37.24) trong `Pane surface`, `Link variant="head"`; node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts. Khối do blocks-core vẽ (`ConnectionsRegion`), không phải fe.
