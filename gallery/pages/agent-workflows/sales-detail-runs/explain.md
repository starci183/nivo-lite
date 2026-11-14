# Chi tiết quy trình: Lượt chạy (sales)

<!-- shown -->
Màn này đang hiển thị quy trình "Tư vấn bán hàng" (`consult`, Bản 1, 5 bước): Có việc mới, Tư vấn khách, Tạo đơn, Gửi QR thanh toán, Báo đội đơn mới.
<!-- /shown -->

Đường dẫn `agents/<loại>/<id>/workflows/<khóa quy trình>` (nhận cả id). Dải tab, đầu trang và các phần đều dùng chung cho bốn phần.

## Đầu trang: tên, bản, trạng thái, lệnh
Vì sao: tên quy trình, dòng "Bản N · số bước · ngày", Badge trạng thái ở đầu; lệnh duy nhất ở cuối hàng là Tạm dừng / Bật lại. Không có lệnh sửa sơ đồ hay thêm bước: sơ đồ là của mẫu và chỉ đọc (2026-11-14).
Luật: header-left-sublabel-xs.md (đầu trang flush trái, sublabel 12), signed-in owner mockup Workflow-Detail/Editor.
Grammar: `PaneHead` (composite của app trên Grammar `PaneHeader`: title, description, status, actions), node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts. Chỉ một Button ở actions, đúng luật PaneHeader.

## Dải tab Vào · Ra, Sơ đồ, Phiên bản, Lượt chạy
Vì sao: bốn phần của một quy trình là tab tầng hai nên nằm ở dải đầu trang màu trắng, ngay dưới dải tab của agent, mỗi phần là một đường dẫn riêng (`/workflows/<khóa>`, `/map`, `/versions`, `/runs`).
Luật: tabs-in-well (tab gạch chân nằm ở dải đầu trang trắng, không nằm trong nền hồng), surfacecard-zones-api.md (gạch chân = tab phụ).
Grammar: `Page` `header.subTabs` do AgentInstanceFrame dựng (`frameSubTabsOf` trong parts.ts), node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts (`PageHeaderTabs`, `subTabs` nằm dưới dải tab của agent) và node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts.

## Bảng lượt chạy của quy trình này
Vì sao: dùng lại bảng lượt chạy của agent (chỉ đọc), lọc theo đúng quy trình này; có tab trạng thái, tìm kiếm và lọc nguồn.
Luật: pink-page-surface-rule.md (thẻ trắng nổi trên nền hồng), surfacecard-zones-api.md (tab lọc gạch chân).
Grammar: `SurfaceCard kind="table"` với `headers` (filter + search), composite AgentRunsTable (của S3, không sửa).
