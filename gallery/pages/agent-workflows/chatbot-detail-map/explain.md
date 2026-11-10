# Chi tiết quy trình: Sơ đồ (chatbot)

<!-- shown -->
Màn này đang hiển thị quy trình "Lễ tân" (`front-desk`, Bản 1, 6 bước): Có việc mới, Hiểu ý khách (4 nhánh: Muốn mua, Báo đã chuyển, Hỏi thông tin, Khiếu nại), hai bước Chuyển sang quy trình (sales/consult, accounting/reconcile), Trả lời câu hỏi, Tiếp nhận khiếu nại, Chuyển chủ tiệm.
<!-- /shown -->

Đường dẫn `agents/<loại>/<id>/workflows/<khóa quy trình>` (nhận cả id). Dải tab, đầu trang và các phần đều dùng chung cho bốn phần.

## Đầu trang: tên, bản, trạng thái, lệnh
Vì sao: tên quy trình, dòng "Bản N · số bước · ngày", Badge trạng thái ở đầu; lệnh của phần đang mở nằm cuối hàng (Sửa sơ đồ, hoặc một nút Thêm bước ở phần Sơ đồ).
Luật: header-left-sublabel-xs.md (đầu trang flush trái, sublabel 12), signed-in owner mockup Workflow-Detail/Editor.
Grammar: `PaneHead` (composite của app trên Grammar `PaneHeader`: title, description, status, actions), node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts. Chỉ một Button ở actions, đúng luật PaneHeader; nút Thêm bước ở phần Sơ đồ mở ngăn chọn loại bước (StepAction add).

## Dải tab Vào · Ra, Sơ đồ, Phiên bản, Lượt chạy
Vì sao: bốn phần của một quy trình là tab tầng hai nên nằm ở dải đầu trang màu trắng, ngay dưới dải tab của agent, mỗi phần là một đường dẫn riêng (`/workflows/<khóa>`, `/map`, `/versions`, `/runs`).
Luật: tabs-in-well (tab gạch chân nằm ở dải đầu trang trắng, không nằm trong nền hồng), surfacecard-zones-api.md (gạch chân = tab phụ).
Grammar: `Page` `header.subTabs` do AgentInstanceFrame dựng (`frameSubTabsOf` trong parts.ts), node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts (`PageHeaderTabs`, `subTabs` nằm dưới dải tab của agent) và node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts.

## Sơ đồ và canvas
Vì sao: sơ đồ thẻ trắng kiểu n8n, cạnh cong, cạnh quay lại nét đứt; bấm một bước mở ngăn tham số. Bước có tham số hiện chip: hồng là gán lúc chạy, xám là cố định.
Luật: flowgraph-card-style.md, workflow-memory-contracts.md, single-child-card (sơ đồ đứng một mình, không bọc thẻ).
Grammar: `Section` (title, caption) + `FlowGraph layout="steps"` với `FlowGraphNode.chips`, `container` cho bước Lặp qua từng, node_modules/@starci/grammar/dist/core/branch/FlowGraph/types.d.ts (0.37.4, 0.37.5, 0.37.20 cho `fit`). Từ Grammar 0.37.29 sơ đồ vẽ kiểu C: trái sang phải, cạnh vuông góc, chấm ở đầu cạnh, mũi tên tam giác, nền chấm phủ cả khung; thu nhỏ tối thiểu 0.8 nên sơ đồ rộng được kéo (pan) chứ không bị ép nhỏ, bộ nút zoom nằm trong khung. Hệ quả: quy trình thẳng 5-6 bước rộng hơn khung nên bước cuối nằm ngoài mép cho tới khi kéo (ghi cho Grammar).

## Nền chấm và kéo thả khối
Vì sao: nền chấm kiểu n8n và khối kéo được để người dùng tự sắp xếp; có nút "Sắp xếp lại" trả về bố cục tự động. Vị trí hiện chỉ giữ trong phiên, chưa lưu về BE.
Luật: flowgraph-card-style.md (người dùng sửa graph).
Grammar: `FlowGraph background="dots" isEditable positions onPositionsChange resetLabel`, node_modules/@starci/grammar/dist/core/branch/FlowGraph/index.d.ts (0.37.5).

## Chú giải loại bước và chú thích
Vì sao: chú giải màu các loại bước nằm dưới thẻ, kèm một dòng giải thích.
Luật: flowgraph-card-style.md (màu theo loại).
Grammar: `FlowGraphLegend` đặt dưới `FlowGraph` trong `Section`, node_modules/@starci/grammar/dist/core/branch/FlowGraph/index.d.ts.

## Ngăn tham số của bước (mở khi bấm một bước)
Vì sao: form do Opus B sở hữu; chủ đã nhắc luật thẻ viền 1px một nhóm một thẻ, cần kiểm tra ở form.
Luật: surfacecard-zones-api.md, flowgraph-card-style.md (ngăn tham số, Lưu thành bản N).
Grammar: Drawer + SurfaceCard, ngoài phạm vi tôi.
