# Chi tiết quy trình: Sơ đồ (sales)

<!-- shown -->
Màn này đang hiển thị quy trình "Tư vấn bán hàng" (`consult`, Bản 1, 5 bước): Có việc mới, Tư vấn khách, Tạo đơn, Gửi QR thanh toán, Báo đội đơn mới.
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
Vì sao: sơ đồ thẻ trắng kiểu n8n, cạnh cong, cạnh quay lại nét đứt; bấm một bước mở ngăn tham số. Bước có tham số hiện chip: hồng là gán lúc chạy, xám là cố định. Chụp lại 2026-11-11 (Grammar 0.37.33, `FlowGraph height="fill"`): thẻ bước 200×64, tên 14 và dòng phụ 12 ở zoom 1 (đo trong trang), cách nhau 40px; chấm đầu cạnh nằm đúng trên mép phải của thẻ nguồn (tâm chấm lệch mép ≤1px: nửa trên thẻ, nửa ra ngoài, đo ở 1440 và 390); khung graph lấy phần còn lại của trang (519px ở 1440, 599px ở 1920, sàn 360px ở 390); ở 390 zoom 0.8 và kéo ngang. CHƯA ĐẠT ở 1440: đồ thị mở ở zoom 1, thẻ thứ 5 "Báo đội đơn mới" cắt mép phải (1445 so với khung 1427) và thẻ cuối "Chốt mua" nằm ngoài khung, dù chỉ cần zoom khoảng 0.86 (trên sàn 0.8) để vừa; ở 1920 thì vừa. Lỗ hổng Grammar: mở-zoom của `fill` không co để vừa khi còn dư chỗ trên sàn 0.8 (DNA-COMMON-FLOW-OPEN-ZOOM).
Luật: flowgraph-card-style.md, workflow-memory-contracts.md, single-child-card (sơ đồ đứng một mình, không bọc thẻ). DNA-COMMON-FLOW-OPEN-ZOOM, DNA-COMMON-FLOW-FRAME-FILL, DNA-COMMON-FLOW-START-DOT (đồ thị trên một trang riêng, bản vẽ graph-state.png).
Grammar: `Section` (title, caption) + `FlowGraph layout="steps"` với `FlowGraphNode.chips`, `container` cho bước Lặp qua từng, node_modules/@starci/grammar/dist/core/branch/FlowGraph/types.d.ts (0.37.4, 0.37.5, 0.37.20 cho `fit`). Từ Grammar 0.37.29 sơ đồ vẽ kiểu C: trái sang phải, cạnh vuông góc, chấm ở đầu cạnh, mũi tên tam giác, nền chấm phủ cả khung; thu nhỏ tối thiểu 0.8 nên sơ đồ rộng được kéo (pan) chứ không bị ép nhỏ, bộ nút zoom nằm trong khung. Hệ quả: quy trình thẳng 5-6 bước rộng hơn khung nên bước cuối nằm ngoài mép cho tới khi kéo (ghi cho Grammar). Chụp lại với Grammar 0.37.33: `FlowGraph height="fill"` (trang Sơ đồ), `fit` mở zoom.

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
