# Kế toán › Bàn làm việc › Quy tắc

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

## Form "Quy tắc kế toán" (trường phẳng trên nền hồng)
Cài đặt của Kế toán; là sub-tab thứ năm, không còn lối vào lơ lửng cuối trang.

Vì sao: Cài đặt đơn là trường phẳng trực tiếp trên nền hồng, không thẻ bao và không tiêu đề lặp lại tên sub-tab: mỗi trường là nhãn 14/500, mô tả, rồi ô nhập (ô số xếp lưới hai cột); mỗi công tắc là MỘT dòng nhãn + mô tả bên trái, công tắc bên phải, chiếm cả bề ngang (mô tả bắt buộc); nhãn là danh từ ngắn; chân form Huỷ + Lưu (chính) canh phải.

Luật: `table-heroui-native-section-head`, contexts/ui/components/field.md FLAT-FIELDS-ON-WELL, SWITCH-LABEL-DESCRIPTION, contexts/ui/components/card.md CARD-NO-DESCRIPTION.

Grammar: `Section` (tiêu đề + `caption`), `Form`, `NumberField`, `Textarea`, `Switch` (`description`); `node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Switch/index.d.ts`.

## Aside "Tài khoản đã gắn" (chỉ đọc)
Vì sao: Một dòng cho mỗi TÀI KHOẢN đã gắn vào agent ("SePay · •••• 9999"), logo nhà cung cấp, dòng 12 mờ liệt kê khả năng đang bật kèm chế độ ("(Tự động)", "(Hỏi)"); đầu khung có tên và đúng một liên kết "Quyền →"; không có nút, không "Tự làm", không "Cấp quyền" vì việc cấp quyền nằm ở tab Quyền. Khung viền 1px, bo góc, không bóng. Chỉ đọc theo bản vẽ quyen-tai-khoan-2 (khung 3). Khác bản vẽ (dữ liệu blocks-core, đã ghi ở LG-REQUESTS "UX/UI"): tên dòng còn lặp tên nhà cung cấp và dòng mô tả bị cắt trước phần chế độ.

Luật: `pink-page-surface-rule` (aside trắng), `surfacecard-select-subtitle` (dòng phụ 12 mờ), `table-heroui-native-section-head` (đầu nhóm: nhãn trái, một liên kết "→" phải).

Grammar: `SurfaceCard kind="list"` (viền 1px, không bóng, 0.37.24) trong `Pane surface`, `Link variant="head"`; node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts. Khối do blocks-core vẽ (`ConnectionsRegion`), không phải fe.
