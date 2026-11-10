# Chi tiết quy trình: Sơ đồ (chatbot)

Đường dẫn `agents/<loại>/<id>/workflows/<khóa quy trình>` (nhận cả id). Dải tab, đầu trang và các phần đều dùng chung cho bốn phần.

## Đầu trang: tên, bản, trạng thái, lệnh
Vì sao: tên quy trình, dòng "Bản N · số bước · ngày", Badge trạng thái ở đầu; lệnh của phần đang mở nằm cuối hàng (Sửa sơ đồ, hoặc một nút Thêm bước ở phần Sơ đồ).
Luật: header-left-sublabel-xs.md (đầu trang flush trái, sublabel 12), signed-in owner mockup Workflow-Detail/Editor.
Grammar: `PaneHeader` (title, description, status, actions), node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts. Chỉ một Button ở actions, đúng luật PaneHeader; nút Thêm bước đang tắt cho đến khi StepAction add có.

## Dải tab Vào · Ra, Sơ đồ, Phiên bản, Lượt chạy
Vì sao: bốn phần của một quy trình là tab tầng hai nên nằm ở dải đầu trang màu trắng, ngay dưới dải tab của agent, mỗi phần là một đường dẫn riêng (`/workflows/<khóa>`, `/map`, `/versions`, `/runs`).
Luật: tabs-in-well (tab gạch chân nằm ở dải đầu trang trắng, không nằm trong nền hồng), surfacecard-zones-api.md (gạch chân = tab phụ).
Grammar: `Page header` với `subTabs` qua AgentInstanceFrame (`FrameSubTabs`), node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts (`Tabs kind="views"`).

## Sơ đồ và canvas
Vì sao: sơ đồ thẻ trắng kiểu n8n, cạnh cong, cạnh quay lại nét đứt; bấm một bước mở ngăn tham số. Bước có tham số hiện chip: hồng là gán lúc chạy, xám là cố định.
Luật: flowgraph-card-style.md, workflow-memory-contracts.md, single-child-card (sơ đồ đứng một mình, không bọc thẻ).
Grammar: `Section` (title, caption) + `FlowGraph layout="steps"` với `FlowGraphNode.chips`, `container` cho bước Lặp qua từng, node_modules/@starci/grammar/dist/core/branch/FlowGraph/types.d.ts (0.37.4, 0.37.5).

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
