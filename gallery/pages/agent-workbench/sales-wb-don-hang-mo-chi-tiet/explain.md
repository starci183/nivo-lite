# Sales › Đơn hàng › chi tiết đơn đang mở

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

## Aside chi tiết (sát phải)
Nhóm Đơn (Khách hàng, Món hàng, Giao tới), Thanh toán (Tổng tiền, Trạng thái), Lịch sử (Tạo lúc, Người xác nhận, Xác nhận lúc). Chỉ mở khi chọn một dòng; không chọn thì không có aside hoặc có nhóm mặc định, không bao giờ aside rỗng. Đầu aside là một hàng dính: tên bản ghi, sublabel mờ, nút đóng nhỏ.

Vì sao: Aside là chrome trắng sát phải; mỗi nhóm khóa–giá trị là một SurfaceCard viền 1px (không bóng) dưới một nhãn nhóm; khóa mờ, giá trị chữ thường; giá trị rỗng thì bỏ dòng.

Luật: `pink-page-surface-rule`, `surfacecard-zones-api` (aside: mỗi nhóm một card viền), contexts/ui/components/card.md WHITE-LIST-BORDERED-CARD.

Grammar: `Pane head={{title, description, onClose, closeLabel}}` (block xin qua `useAsideHead`), `SurfaceCard kind="list" layout="keyValue"` + `value`; `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

