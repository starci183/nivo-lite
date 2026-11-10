# Chi tiết lượt chạy (Chatbot Lễ tân, lượt xong, lượt thread)

## Đầu lượt: tên lượt, #mã, trạng thái (icon outline + chữ), dòng "Chạy lúc … · Bắt đầu từ … · ở bước n/m"
Vì sao: không đặt trong thẻ (một câu không thành thẻ riêng); trạng thái là icon outline đứng cạnh chữ, không tile; dòng phụ cỡ 12 xám cho biết lượt do ai/kênh nào khởi động, không lặp tên quy trình.
Luật: ui-laws.md (Single sentence, Icons, Type); memory verify-against-visualize.
Grammar: `Heading`, `Text size="xs" tone="muted"`; icon `AgentRunStatusMark` (outline).

## Nút "Thử lại" (chỉ khi lượt lỗi) và "Huỷ lượt"
Vì sao: một nút chính duy nhất mỗi trang; "Thử lại" là nút chính có icon, "Huỷ lượt" là nút trung tính có hộp xác nhận.
Luật: ui-laws.md (Buttons: one primary, pill, only commit md/lg has an icon). Khi trang đang chờ một quyết định hoặc có khách bị đóng băng, nút chính là của thẻ đó và "Thử lại" ở đầu lượt thành nút trung tính: luôn chỉ một nút chính.
Grammar: `Button intent="commit"` và `intent="neutral"`, `AlertDialog`; `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/buttonIntent.d.ts`.

## Đầu thẻ sơ đồ: "Quy trình · tên" + "Bản n" + liên kết "Mở quy trình →"
Vì sao: đầu mục là một hàng: nhãn và chip bên trái, đúng một liên kết điều hướng bên phải, không mô tả.
Luật: ui-laws.md (Section head); table-heroui-native-section-head.
Grammar: `SurfaceCard label` + `fact` + `labelEnd=<Link variant="head">`, `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts` (CardHead).

## Sơ đồ chạy (các bước đã đi + nhánh có thể đi)
Vì sao: OK — dùng bản đồ thẻ của quy trình, chỉ vẽ đường lượt đã đi và các nhánh rẽ không đi (mờ); chữ ở cỡ đọc được, kéo và thu phóng bằng nút +/−/vừa khung; nét liền là nhánh đã chạy, nét đứt là chưa; bấm một thẻ để xem tham số ở cột phải.
Luật: ui-laws.md (Graphs: FlowGraph layout steps); flowgraph-card-style.
Grammar: `FlowGraph layout=\"steps\" fit=\"readable\" showControls` với `status`, `isTaken`, `onNodePress`; `node_modules/@starci/grammar/dist/core/branch/FlowGraph/index.d.ts`.

## Chú giải dưới sơ đồ (loại bước, trạng thái)
Vì sao: chú giải nằm dưới thẻ dạng chip, không nằm trong thẻ.
Luật: ui-laws.md (Section head: legends under the card).
Grammar: `SurfaceCard note={<FlowGraphLegend/>}`, `FlowGraphLegend`.

## Cột phải, đầu cột: tên bước và loại bước
Vì sao: cột bên là mặt phẳng trắng sát mép, không phải thẻ; đầu cột là một hàng dính (tên bước, loại bước 12 xám) và không cuộn mất.
Luật: ui-laws.md (Layout B: aside flush right, white).
Grammar: `Pane area="aside" surface head={{title, description}} collapse="drawer"` (đầu cột dính, ngăn kéo khi hẹp), `frame/PaneGrid/index.d.ts` (PaneHeadSlot, 0.37.5).

## Nhóm Trạng thái (Trạng thái, Bắt đầu, Kết thúc, Lỗi)
Vì sao: danh sách trên nền trắng là một danh sách có viền, mỗi nhóm một khối với nhãn phía trên; lỗi hiện mã và lời.
Luật: ui-laws.md (Groups, Surfaces: surface on white = border no shadow); đã chủ nhắc lại "danh sách trên nền trắng".
Grammar: `SurfaceCard kind="list"` (từ Grammar 0.37.5 thẻ được phép trên nền trắng), `ListRowData` (title, meta, description), `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Nhóm Đầu vào (chip số) — tên tham số, "= trigger.leadId", giá trị đã giải
Vì sao: mỗi tham số một dòng: tên, nguồn của giá trị (ref hoặc cố định), giá trị thực của lượt này. Giá trị bí mật hoặc thông tin riêng tư được che; id thô không hiện, tên khách là liên kết, id chỉ hiện khi rê chuột.
Luật: workflow-memory-contracts (refs "= steps.x.output.y"); ui-laws.md (no raw ids).
Grammar: `SurfaceCard kind="list" layout="keyValue"` + `Sublabel` và chip đếm, `ListRowData.value`, `Link`, `Tooltip` (`D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/../common`).

## Nhóm Kết quả
Vì sao: đầu ra của bước; với bước rẽ nhánh thì kết quả là nhánh đã đi ("Chưa có → Phân loại ý định").
Luật: workflow-memory-contracts (output schema, nhánh); ui-laws.md (Groups).
Grammar: như trên.

## Nhóm Nhánh (tên cổng → bước đích, dòng đã đi)
Vì sao: mỗi nhánh một dòng, nhánh lượt này đã đi có chip "Đã đi" và dòng "Lượt này đã đi nhánh …" làm dòng phụ; tên nhánh lấy từ chữ của cổng trên sơ đồ.
Luật: workflow-memory-contracts (cổng "lỗi" và nhánh); ui-laws.md (Language: no raw keys).
Grammar: `SurfaceCard kind="list" layout="rows"`, `ListRowData.badges`, `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Bảng "Gọi AI" dưới sơ đồ (chip số loại; Loại gọi, Lần gọi, Token vào + từ cache, Token ra + suy luận, Thời gian + chậm nhất, Chi phí, Mô hình)
Vì sao: một dòng cho mỗi loại gọi AI của lượt, để chủ thấy lượt này tốn bao nhiêu và gọi mô hình nào; số căn phải, số phụ (cache, suy luận, chậm nhất) cỡ 12 xám dưới số chính; chi phí đổi sang US$. Cột "Loại gọi" là tên tiếng Việt của bước ("Hiểu ý khách").
Luật: table-heroui-native-section-head (bảng HeroUI gốc, đầu mục = nhãn + chip); type-scale-14-12; ui-laws.md (Language: no raw keys).
Grammar: `SurfaceCard kind="table"` + `Table` (cột số `align="end"`), `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Ở 390 (điện thoại)
Vì sao: sơ đồ đổi thành danh sách "Các bước" (mỗi bước một dòng: tên, trạng thái, thời gian, mũi tên) vì sơ đồ trái sang phải không đọc được ở bề ngang này; cột phải thành ngăn kéo mở khi bấm một bước; bảng "Gọi AI" cuộn ngang trong thẻ, mặc định thấy 3 cột đầu.
Luật: flowgraph-card-style (390: kéo và thu phóng); ui-laws.md (Layout B: aside thành ngăn kéo khi hẹp).
Grammar: `FlowGraph` thay bằng `SurfaceCard kind="list"` ở bề hẹp, `Pane area="aside" collapse="drawer"`.

## Sơ đồ Lễ tân: thẻ rẽ nhánh "Hiểu ý khách" với bốn cổng (Muốn mua, Báo đã chuyển, Hỏi thông tin, Khiếu nại) và các thẻ "Chuyển sang quy trình"
Vì sao: lượt này đi cổng "Muốn mua" (đường xanh liền, chấm ra đặt đúng mép thẻ) rồi bàn giao sang agent Sales; các nhánh còn lại mờ, nét đứt vì không đi. Thẻ bàn giao cao hơn 64 vì có ba chip tham số (Agent nhận việc, Quy trình, Phiên bản); chữ vẫn 14/12.
Luật: flowgraph-card-style (style C, trái sang phải, nhánh rời một trục chung, chấm ra trên mép thẻ, đường đã đi xanh); workflow-memory-contracts (bàn giao ghi rõ đích và tham số).
Grammar: `FlowGraph layout="steps" fit="readable"`, cổng của nút điều kiện; `node_modules/@starci/grammar/dist/core/branch/FlowGraph/index.d.ts`.

## Trang dài ở 1440 và 1920
Vì sao: sơ đồ chiếm phần cao còn lại của khung (tối thiểu 360) nên bảng "Gọi AI" nằm dưới màn đầu; ảnh chỉ chụp màn đầu, bảng thấy ở 390.
Luật: flowgraph-card-style (khung sơ đồ lấy phần cao còn lại).
Grammar: `FlowGraph` trong `SurfaceCard`.
