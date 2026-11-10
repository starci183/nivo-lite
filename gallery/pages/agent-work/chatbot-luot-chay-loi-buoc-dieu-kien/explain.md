# Chi tiết lượt chạy lỗi (Chatbot): đã bấm bước điều kiện "Đang tư vấn?", 1440

## Thẻ bước được chọn trên sơ đồ
Vì sao: bấm một thẻ bước chọn bước đó; thẻ được viền đỏ để biết cột phải đang nói về bước nào.
Luật: ui-laws.md (Graphs: FlowGraph layout steps); flowgraph-card-style.
Grammar: `FlowGraph layout="steps" selectedId onNodePress`, `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/branch/FlowGraph/index.d.ts`.

## Cột phải, đầu cột: tên bước "Đang tư vấn?" và loại "Điều kiện"
Vì sao: cột bên là mặt phẳng trắng sát mép phải; đầu cột là hàng dính chứa tên bước và loại bước.
Luật: ui-laws.md (Layout B: aside flush right).
Grammar: `Pane area="aside" surface head={{title, description}} collapse="drawer"`, `frame/PaneGrid/index.d.ts` (PaneHeadSlot, 0.37.5).

## Nhóm Trạng thái (Trạng thái Xong, Bắt đầu 12:58:05)
Vì sao: danh sách trên nền trắng là thẻ danh sách có viền (không bóng), mỗi nhóm một khối với nhãn phía trên.
Luật: ui-laws.md (Groups, Surfaces); chủ nhắc "danh sách trên nền trắng".
Grammar: `SurfaceCard kind="list" layout="keyValue"` + `ListRowData` (title là khoá, value là giá trị), `surfaceCardData.d.ts` (ListData.layout, 0.37.5).

## Nhóm Đầu vào (chip 1): Mã khách, "= trigger.leadId", "Khách Zalo ↗"
Vì sao: tên tham số, nguồn của giá trị, giá trị đã giải. Không hiện id thô: tên khách là liên kết, id chỉ hiện khi rê chuột.
Luật: workflow-memory-contracts; ui-laws.md (Language: no raw ids, Links).
Grammar: `SurfaceCard kind="list" layout="keyValue"` + `Sublabel` và chip đếm, `ListRowData.value`, `Link`, `Tooltip`.

## Nhóm Kết quả: "Nhánh đã đi: Chưa có → Phân loại ý định"
Vì sao: bước điều kiện không trả dữ liệu, kết quả của nó là nhánh đã chọn.
Luật: workflow-memory-contracts (nhánh, đầu ra của bước).
Grammar: `SurfaceCard kind="list"`, `ListRowData`.

## Nhóm Nhánh: "Đang mở → Chuyển cho agent", "Chưa có → Phân loại ý định" (chip "Đã đi")
Vì sao: tên nhánh lấy chữ của cổng trên sơ đồ ("Đang mở", "Chưa có"); nhánh lượt này đã đi có chip và dòng phụ giải thích.
Luật: workflow-memory-contracts (cổng, nhánh); ui-laws.md (no raw keys).
Grammar: `SurfaceCard kind="list" layout="rows"`, `ListRowData.badges`, `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.
