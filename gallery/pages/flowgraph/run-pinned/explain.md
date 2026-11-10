---
title: Lượt chạy / Bước được ghim trên sơ đồ (bố cục cũ)
route: /workspaces/<ws>/agents/<module>/<installation>/work/runs/<runId>
area: flowgraph
---
Shots: `1440.png` (Kế toán, lượt "#bbc4fd", một bước của bản mẫu cũ được chọn), `1440-run.png` (cùng trang), `1440-drawer.png` (ngăn kéo tham số chỉ đọc của một bước của bản mẫu cũ). Đây là bố cục TRƯỚC khi chuyển sang cột phải; bố cục hiện tại nằm ở `agent-work/run` (đầu lượt, sơ đồ, cột phải các nhóm tham số). Code hiện tại: `fe/apps/web/src/components/blocks/AgentRunPanes/component.tsx`. Grammar d.ts dưới `node_modules/@starci/grammar/dist/core/`.

## Toàn bộ bố cục (cột bước bên trái, sơ đồ, hộp "Agent đã làm")
Vì sao: SAI — shot không còn khớp code: code hiện tại không có cột danh sách bước trắng bên trái, không có hộp "Agent đã làm" / "Đầu vào" / "Chi tiết kỹ thuật" bên dưới sơ đồ mà đặt các nhóm tham số vào cột phải (aside) và, trên điện thoại, danh sách bước là một thẻ. Gallery vì vậy đang chứng minh một UI đã bị thay. Should be: chụp lại theo bố cục hiện tại (xem `agent-work/run`) và coi thư mục này là lịch sử, hoặc xoá.
Luật: `verify-against-visualize`, `gallery-explain-per-page`.
Grammar: `PaneGrid areas` main + aside, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`.

## Cột trái: danh sách bước (các bước của bản mẫu cũ, đã bị xóa; ảnh chưa chụp lại)
Vì sao: SAI — danh sách bước là một cột trắng có dòng chọn tô xám, icon check outline bên trái, tên đậm và "Xong" 12px dưới; đây là `ListBox` tự dựng trên mặt phẳng trắng (luật: danh sách trên mặt phẳng trắng là SurfaceCard có viền, và bước đã có trên sơ đồ nên là nội dung lặp). Icon trạng thái là outline không tile (đúng). Should be: bỏ cột (bản đồ đã là danh sách bước), hoặc `SurfaceCard kind="list"` có viền.
Luật: `surfacecard-zones-api` (Repeated violation), `verify-against-visualize` (status = icon outline, không tile).
Grammar: `SurfaceCard kind="list"`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`; `ListBox`, `node_modules/@starci/grammar/dist/core/branch/ListBox/index.d.ts`.

## Nhãn "Sơ đồ chạy" và bản đồ chạy
Vì sao: SAI một phần — bản đồ vẽ các thẻ bước đã đi với viền xanh (thành công) và mũi tên đã đi dày màu hồng đậm; thẻ đang chọn có viền hồng và nhãn "Chờ" ở góc; điều khiển zoom góc dưới trái. Đúng luật lớp phủ trạng thái. Nhưng nhánh đã đi tô hồng đậm cùng màu với "Lỗi/Cần chủ" của thương hiệu, nên nhánh bình thường và nhánh cần chú ý khó phân biệt; màu thiết kế không đổi theo ý riêng (owner-colors-exact), nên cần chủ quyết màu cạnh đã đi. Graph 5 bước nên hiển thị đọc được (chữ 14px).
Luật: `flowgraph-card-style`, `owner-colors-exact` (không tự đổi màu thiết kế).
Grammar: `FlowGraph layout="steps" status isTaken`, `node_modules/@starci/grammar/dist/core/branch/FlowGraph/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/FlowGraph/types.d.ts`.

## Chú giải dưới bản đồ (loại bước, chip trạng thái, câu "Nét liền là nhánh đã đi…")
Vì sao: dưới thẻ, không trong thẻ: hàng loại bước, hàng chip trạng thái Xong / Đang chạy / Chờ bạn / Lỗi / Chưa chạy và một câu 12px giải thích nét liền và nét đứt, hướng dẫn "Bấm một nút để xem chi tiết bước".
Luật: `table-heroui-native-section-head` (legends under the card), `surfacecard-select-subtitle`.
Grammar: `SurfaceCard note`, `FlowGraphLegend`, `node_modules/@starci/grammar/dist/core/branch/FlowGraph/stepsView.d.ts`.

## Nhóm "Agent đã làm" (Đã làm, Kết quả, Tiếp theo) + "Lần thử 1/3"
Vì sao: ba dòng khóa-giá trị trong một thẻ chi tiết, nhãn nhóm là Sublabel 12 muted phía trên: một câu tóm tắt "Đã làm / Kết quả / Tiếp theo" được luật nêu làm ví dụ cho "lone sentence → rows of a list card"; "Lần thử 1/3" là chú thích dưới thẻ.
Luật: `table-heroui-native-section-head` (lone sentence → list rows; example "Agent đã làm"), `surfacecard-zones-api`.
Grammar: `SurfaceCard kind="details"`, `Sublabel`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Nhóm "Đầu vào" (Tin của khách, Kênh)
Vì sao: SAI — giá trị "billing.bankFeedTag" là khóa máy hiển thị cho chủ ở dòng "Tin của khách" (nội dung đáng ra là câu tiếng Việt hoặc nhãn "Sao kê ngân hàng"); "Kênh = Sao kê ngân hàng" đúng. Should be: giá trị thô chỉ nằm trong "Chi tiết kỹ thuật", nhãn người đọc ở đây.
Luật: `flowgraph-card-style` (all labels Vietnamese, never raw keys), `workflow-memory-contracts`.
Grammar: `SurfaceCard kind="details"`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Nhóm "Chi tiết kỹ thuật" ("Xem mã và giá trị gốc (5)")
Vì sao: id và giá trị gốc gói trong một thẻ thu gọn, đúng luật "Raw ids go in a Chi tiết kỹ thuật list card, collapsed".
Luật: `table-heroui-native-section-head` (raw ids in "Chi tiết kỹ thuật", collapsed).
Grammar: `SurfaceCard kind="accordion"`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Ngăn kéo tham số của bước (chỉ đọc) — `1440-drawer.png`
Vì sao: bấm một bước mở ngăn kéo phải với tên, mô tả, câu "Tham số mà lượt chạy này đã dùng. Chỉnh tham số ở thẻ Quy trình.", nhóm "Tham số" và trường "Khoảng tìm tiền về 72 giờ" chỉ đọc; không có chân vì lượt đã chạy không sửa được (tham số sửa ở quy trình). Cách này đã được thay bằng cột phải trong bố cục hiện tại.
Luật: `flowgraph-card-style` (a run's drawer is read only), `surfacecard-select-subtitle` (flat fields).
Grammar: `Drawer`, `NumberField isReadOnly`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/NumberField/index.d.ts`.
