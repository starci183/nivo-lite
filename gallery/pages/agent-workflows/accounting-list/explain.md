# Quy trình của agent: bảng quy trình (accounting)

Tab "Quy trình" là tab cấp một của agent (Bàn làm việc, Công việc, Graph, Quy trình, Trò chuyện, Kết nối, Tri thức, Thiết lập). Đường dẫn `agents/<loại>/<id>/workflows`. Đường cũ `setup/workflows` chuyển hướng về đây.

## Dải tab của agent
Vì sao: Quy trình đã ra khỏi Thiết lập và là tab riêng, nằm sau Graph. Thiết lập chỉ còn Hướng dẫn và Chung.
Luật: owner 2026-11-09 (tab Quy trình cấp một), workflow-memory-contracts.md.
Grammar: `Tabs` (kind views), node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts, qua AgentInstanceFrame.

## Đầu trang: tiêu đề "Quy trình" và nút "Tạo quy trình"
Vì sao: một lệnh chính duy nhất của trang nằm ở đầu hàng tiêu đề, là nút hồng đặc; không đặt nút trong thẻ.
Luật: nivo-ui-laws (một primary mỗi trang), header-left-sublabel-xs.md (đầu trang flush trái).
Grammar: `PaneHeader` (title, actions) qua composite PaneHead với `primary`, node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts.

## Thẻ bảng "Quy trình" và số lượng
Vì sao: danh sách quy trình là dữ liệu nhiều cột nên là bảng đứng một mình: bảng chính là bề mặt (khung xám), tiêu đề và chip đếm nằm trên đầu bảng bằng Section, một dòng chú thích 12 nằm dưới; không bọc thêm thẻ.
Luật: single-child-card (chủ 2026-11-09), table-heroui-native-section-head.md (bảng khung xám, đầu = nhãn + chip đếm).
Grammar: `Section` (title, count, caption) + `DataTable` (label, columns, rows, renderCell, surface mặc định card), node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts và node_modules/@starci/grammar/dist/core/branch/DataTable/index.d.ts.

## Cột Bắt đầu khi, Kết thúc → gọi tiếp, Cửa vào
Vì sao: mỗi quy trình có nguồn kích hoạt, các kết thúc kèm quy trình gọi tiếp, và quy tắc cửa vào; đọc từ hợp đồng (agentWorkflowGraph). Một ô chưa có dữ liệu hiện chữ "Chưa có" (không để trống).
Luật: workflow-memory-contracts.md (trigger có nguồn, kết thúc nêu đích, cửa vào).
Grammar: `TableColumnData` (hideBelow, width), Badge tone neutral, node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts.

## Cột Bản, Lượt 7 ngày, Trạng thái
Vì sao: bản đang chạy, số lượt 7 ngày (chưa có từ BE nên hiện "-") và trạng thái bằng Badge chấm.
Luật: flowgraph-card-style.md (tiếng Việt, không lộ khóa thô), type-scale-14-12.md.
Grammar: `Badge isDot tone`, node_modules/@starci/grammar/dist/core/leaf/Badge/index.d.ts; `TableColumnData numeric`.

## Chú thích dưới bảng
Vì sao: một dòng 12px mờ giải thích "Cửa vào: Mở" và "Chỉ agent".
Luật: type-scale-14-12.md (chú thích 12, nhạt), table-heroui-native-section-head.md (không mô tả ở đầu thẻ).
Grammar: `Section caption`, node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts.
