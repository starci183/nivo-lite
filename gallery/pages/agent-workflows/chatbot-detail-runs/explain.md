# Chi tiết quy trình: Lượt chạy (chatbot)

Đường dẫn `agents/<loại>/<id>/workflows/<khóa quy trình>` (nhận cả id). Dải tab, đầu trang và các phần đều dùng chung cho bốn phần.

## Đầu trang: tên, bản, trạng thái, lệnh
Vì sao: tên quy trình, dòng "Bản N · số bước · ngày", Badge trạng thái ở đầu; lệnh của phần đang mở nằm cuối hàng (Sửa sơ đồ, hoặc một nút Thêm bước ở phần Sơ đồ).
Luật: header-left-sublabel-xs.md (đầu trang flush trái, sublabel 12), signed-in owner mockup Workflow-Detail/Editor.
Grammar: `PaneHeader` (title, description, status, actions), node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts. Chỉ một Button ở actions, đúng luật PaneHeader; nút Thêm bước đang tắt cho đến khi StepAction add có.

## Dải tab Vào · Ra, Sơ đồ, Phiên bản, Lượt chạy
Vì sao: bốn phần của một quy trình là tab tầng hai nên nằm ở dải đầu trang màu trắng, ngay dưới dải tab của agent, mỗi phần là một đường dẫn riêng (`/workflows/<khóa>`, `/map`, `/versions`, `/runs`).
Luật: tabs-in-well (tab gạch chân nằm ở dải đầu trang trắng, không nằm trong nền hồng), surfacecard-zones-api.md (gạch chân = tab phụ).
Grammar: `Page header` với `subTabs` qua AgentInstanceFrame (`FrameSubTabs`), node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts (`Tabs kind="views"`).

## Bảng lượt chạy của quy trình này
Vì sao: dùng lại bảng lượt chạy của agent (chỉ đọc), lọc theo đúng quy trình này; có tab trạng thái, tìm kiếm và lọc nguồn.
Luật: pink-page-surface-rule.md (thẻ trắng nổi trên nền hồng), surfacecard-zones-api.md (tab lọc gạch chân).
Grammar: `SurfaceCard kind="table"` với `headers` (filter + search), composite AgentRunsTable (của S3, không sửa).
