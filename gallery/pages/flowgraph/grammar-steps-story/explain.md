---
title: Grammar story: FlowGraph layout="steps" (top-down và left-to-right)
route: Storybook, story "FlowGraph / Steps" (không phải trang app)
area: flowgraph
---
Shot: `1440.png` (hai biến thể của story: "Top down (default), in a card" và "Left to right"). Đây là bản gốc của Grammar mà app so sánh: app không tô lại màu hay cỡ, chỉ cấp dữ liệu. Code: `node_modules/@starci/grammar/dist/core/branch/FlowGraph/steps.d.ts`, `stepsView.d.ts`, `types.d.ts`, `index.d.ts`. Grammar d.ts dưới `node_modules/@starci/grammar/dist/core/`. Nhãn tiêu đề tiếng Anh của hai biến thể ("Top down", "Left to right") chỉ là chú thích của story, không phải UI sản phẩm.

## Thẻ bước: ô icon theo loại, tên 14/500, một dòng phụ 12 muted
Vì sao: mỗi bước là thẻ trắng bo 14 có viền 1px, ô icon 32px tô theo loại bước, tiêu đề tiếng Việt và một dòng phụ ("Giao dịch ngân hàng mới", "Đọc nội dung chuyển khoản"), nhãn góc nhỏ ("Kích hoạt", "Cần chủ", "Chờ"). Đúng mẫu thẻ n8n đã được chủ duyệt.
Luật: `flowgraph-card-style`, `type-scale-14-12`.
Grammar: `FlowGraph layout="steps"` node `{ id, label, description, kind, tag }`, `node_modules/@starci/grammar/dist/core/branch/FlowGraph/types.d.ts`.

## Màu của các loại bước (Sự kiện xanh dương, Việc làm xanh lá, Điều kiện cam, Cần chủ đỏ, Chờ xám)
Vì sao: CHƯA RÕ — luật `flowgraph-card-style` ghi: sự kiện / chuyển agent tím, việc làm xanh ngọc (teal), điều kiện hổ phách, hỏi chủ san hô, chờ xám nét đứt. Story vẽ sự kiện xanh dương, việc làm xanh lá, cần chủ đỏ; app Nivo thì vẽ sự kiện và "Cần chủ" cùng tông hồng thương hiệu và việc làm xanh lá. Ba bảng màu khác nhau cho cùng một loại bước, và không ai ghi rõ bảng nào là chuẩn (Grammar Core dùng token HeroUI, Nivo theo thương hiệu). Màu thiết kế không được đổi tự ý, nên cần chủ chốt một bảng và Grammar ghi vào token; trước đó không thể nói shot nào đúng.
Luật: `flowgraph-card-style`, `owner-colors-exact`, `grammar-core-heroui`.
Grammar: `FlowGraphStepKind`, `FlowGraphTone`, `node_modules/@starci/grammar/dist/core/branch/FlowGraph/types.d.ts`.

## Thẻ điều kiện với cổng đầu ra có tên (Có / Không, Khớp / Lệch)
Vì sao: thẻ điều kiện có dải cổng ở đáy, mỗi nhánh đi ra từ đúng cổng của nó, không có nhãn nổi trên cạnh; tên cổng là chữ Việt.
Luật: `flowgraph-card-style` (named output ports, no floating edge labels), `workflow-memory-contracts` (cổng và nhánh).
Grammar: node `ports`, `FlowGraphPort`, `node_modules/@starci/grammar/dist/core/branch/FlowGraph/types.d.ts`.

## Cạnh cong, cạnh quay lại nét đứt có nhãn pill ("chủ duyệt", "chủ khớp")
Vì sao: cạnh nối cong theo chiều dọc, mũi tên ở đích; cạnh quay lại (từ bước chờ chủ trở về bước trước) nét đứt có nhãn pill nhỏ, đúng ngoại lệ duy nhất của "không nhãn nổi trên cạnh".
Luật: `flowgraph-card-style` (curved connectors; return/back edges dashed with a small pill label).
Grammar: `FlowGraphEdge { source, target, label, variant }`, `node_modules/@starci/grammar/dist/core/branch/FlowGraph/types.d.ts`.

## Điểm cuối "Xong" (pill có dấu check)
Vì sao: kết thúc luôn là pill "Xong" với check, không phải thẻ; dưới thẻ "Báo Sales".
Luật: `flowgraph-card-style` (end = "Xong" pill with check).
Grammar: node `kind="end"`, `node_modules/@starci/grammar/dist/core/branch/FlowGraph/types.d.ts`.

## Thẻ đang chọn (viền xanh dương, bước "Tìm mã đơn")
Vì sao: SAI — viền chọn trong story xanh dương (accent mặc định HeroUI), còn app hiển thị viền hồng của thương hiệu; cùng một tương tác nhưng hai màu, nghĩa là story không phản ánh token thương hiệu mà app đang dùng, và không chứng minh được màu đã chốt. Should be: story chạy dưới theme Nivo (accent = primary hồng) để gallery và app khớp.
Luật: `owner-colors-exact` (links = exact primary; never swap a design colour), `grammar-core-heroui` (Core dùng token HeroUI; mỗi grammar có style riêng).
Grammar: `FlowGraph selectedId onNodePress`, `node_modules/@starci/grammar/dist/core/branch/FlowGraph/index.d.ts`.

## Điều khiển zoom (+, −, vừa khung)
Vì sao: ba nút icon vuông xếp dọc ở góc dưới trái (phóng, thu, vừa khung) để kéo/zoom canvas lớn hơn khung; nút icon-only này là điều khiển của canvas, không thuộc luật "nút sm không icon" (đó là Button chữ), nhưng chúng chồng lên nội dung graph ở mép trái (xem `workflow-detail`, pill "Xong" bị đè).
Luật: `flowgraph-card-style`.
Grammar: `FlowGraph showControls`, `node_modules/@starci/grammar/dist/core/branch/FlowGraph/index.d.ts`.

## Chú giải loại bước nằm TRONG thẻ (Sự kiện, Việc làm, Điều kiện, Cần chủ, Chờ)
Vì sao: SAI — story vẽ hàng chú giải bên trong khung thẻ ở đáy (có đường kẻ trên), trong khi luật là chú giải nằm DƯỚI thẻ như chú thích 12px; ở app `FlowGraphLegend` được đặt trong `SurfaceCard note` (dưới thẻ) nên hai nơi lệch nhau. Should be: story đặt `FlowGraphLegend` ở `note` của SurfaceCard như app.
Luật: `table-heroui-native-section-head` (legends and captions sit under the card), `flowgraph-card-style`.
Grammar: `FlowGraphLegend`, `node_modules/@starci/grammar/dist/core/branch/FlowGraph/stepsView.d.ts`; `SurfaceCard note`.

## Biến thể "Left to right" (không có thẻ bao, nền xám)
Vì sao: SAI — biến thể ngang vẽ trực tiếp trên nền xám nhạt không có thẻ trắng bao ngoài (khác biến thể dọc "in a card"), graph tràn khỏi mép phải và các thẻ cuối bị cụt ("Ghi nhận đã tra", "Chờ chủ khớp" cắt chữ), nên không xem được toàn bộ khi mở; luật: graph nằm trong thẻ hoặc pane full-bleed, và khung nhìn đầu phải thấy cả graph hoặc có cuộn. NIVO dùng hướng dọc, nên biến thể ngang chỉ là khả năng của Grammar. Should be: dùng `fit="readable"` để khung tăng cao/rộng theo graph và thêm thẻ bao như biến thể dọc.
Luật: `flowgraph-card-style` (top-down layout), `nivo-surface-layering`.
Grammar: `FlowGraph direction="lr" fit`, `node_modules/@starci/grammar/dist/core/branch/FlowGraph/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/FlowGraph/layout.d.ts`.
