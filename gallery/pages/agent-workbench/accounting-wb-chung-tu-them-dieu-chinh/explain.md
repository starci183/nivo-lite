# Kế toán › Chứng từ › Thêm điều chỉnh

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

## Form điều chỉnh trong aside
Hai trường phẳng: Lý do (bắt buộc) và Số tiền đúng; nút Ghi điều chỉnh và Hủy.

Vì sao: Hai trường đơn nằm phẳng trong aside, mỗi trường nhãn + ô; không thẻ bao.

Luật: `surfacecard-zones-api`, contexts/ui/components/field.md FLAT-FIELDS-ON-WELL.

Grammar: `Form`, `Textarea`, `NumberField`, `Button`; `node_modules/@starci/grammar/dist/core/frame/Form/index.d.ts`.

