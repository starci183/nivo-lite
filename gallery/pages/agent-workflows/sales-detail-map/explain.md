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

## Chú giải loại bước
Vì sao: chú giải nằm dưới sơ đồ và chỉ liệt kê loại đang có trên sơ đồ; điều kiện có mẫu hình thoi, khung vòng lặp có mẫu nét đứt. Không còn dòng chú thích riêng: khung tự mang dòng giải thích của nó.
Luật: flowgraph-card-style.md (màu theo loại).
Grammar: `FlowGraphLegend` đặt dưới `FlowGraph`, mục `{ kind: "loop" }` và `shape: "diamond"` (Grammar 0.39.1), node_modules/@starci/grammar/dist/core/branch/FlowGraph/types.d.ts.

## Ngăn tham số của bước (mở khi bấm một bước)
Vì sao: form do Opus B sở hữu; chủ đã nhắc luật thẻ viền 1px một nhóm một thẻ, cần kiểm tra ở form.
Luật: surfacecard-zones-api.md, flowgraph-card-style.md (ngăn tham số, Lưu thành bản N).
Grammar: Drawer + SurfaceCard, ngoài phạm vi tôi.

## Các loại thẻ trên sơ đồ khi quy trình có vòng lặp (cập nhật 2026-11-14, FE-MAP-2, chưa chụp lại ảnh)
Vì sao: quy trình bán hàng "một lượt chạy cho cả việc bán" (`sales.consult` bản 30, 35 bước) có hai vòng lặp (tư vấn, thanh toán), hai bước chờ và bảy điều kiện. Mọi lời trên sơ đồ là lời của chính đồ thị (nhãn của điều kiện, chờ, vòng lặp, trả lại tin, tiêu đề kết quả, hai lối thoát của vòng lặp); bản đồ không tự đặt lời, trừ dòng chờ ghép từ sự kiện và thời gian chờ.
- Thẻ "Có việc mới" (Sự kiện) chỉ một thẻ, ghi các nguồn thật của quy trình (từ `triggers` của spec) làm dòng phụ.
- Vòng lặp (`core.until`) là khung nét đứt bao các bước thân vòng (`container.kind: "loop"`): tên của đồ thị, "lặp tối đa N vòng" mờ sau tên, một dòng mờ trong khung nói vòng chạy lại từ bước đầu, hai lối thoát là pill nằm trên mép khung (lời của đồ thị: "Thoát khi ..." và "Hết N vòng mà chưa ..."); cạnh đi tiếp rời khung từ đúng pill của nó.
- Chờ (`core.wait`) là thẻ loại Chờ: dòng phụ = các sự kiện nó chờ + "tối đa 1 ngày"; mỗi đường đi tiếp là một cổng (tin nhắn của khách gộp một cổng); đường hết giờ là cạnh nét đứt (`isFallback`).
- Điều kiện (`core.when`) là hình thoi, câu hỏi của đồ thị nằm trong thoi ("Đủ tiền?"), hai nhánh Có / Không ở hai đỉnh.
- Trả lại tin (`core.hand-back`) là thẻ nhỏ theo nhãn của đồ thị; kết thúc ghi tiêu đề kết quả, không phải khóa.
- Bước việc và gọi quy trình khác giữ kiểu thẻ đã duyệt.
Luật: flowgraph-card-style.md (thẻ bước, cổng điều kiện, cạnh nét đứt cho đường hết giờ), type-scale-14-12.md (chữ 14, nhỏ 12, không dưới 12), owner-colors-exact.md (chỉ token).
Grammar: `FlowGraphNode.shape: "diamond"`, `FlowGraphNode.container` (`kind: "loop"`, `description`, `note`, `exits`, `childIds`), `FlowGraphEdge.sourcePort` (kể cả lấy lối thoát của khung làm nguồn) và `isFallback`, node_modules/@starci/grammar/dist/core/branch/FlowGraph/types.d.ts (0.39.1). Cần chụp lại: vòng thanh toán 13 thẻ ở 1440 (mở rộng khoảng 2000px, cuộn ngang), thoi, pill lối thoát, cạnh hết giờ nét đứt, chú giải, 390.
