# Công việc: lượt chạy của Kế toán

## Dải đầu trang (đường dẫn, tên agent, tab Công việc, tab con Việc đang làm / Lượt chạy)
Vì sao: chữ căn trái, dải đầu không bao giờ cuộn mất; tab tầng 2 nằm trong dải đầu, không nằm trên nền hồng.
Luật: ui-laws.md (Layout, Tabs); memory page-header-left-sublabel-xs.
Grammar: `Page header` (`subTabs`) và `Tabs`, `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`. Dải này thuộc khung agent, không do trang này vẽ.

## Thẻ bảng "Lượt chạy" + chip số lượt
Vì sao: một nội dung một thẻ; bảng có nhiều cột nên là bảng; chip số là chip 12px xám, không viết "· N".
Luật: ui-laws.md (Tables, Section head); table-heroui-native-section-head.
Grammar: `SurfaceCard kind="table"` với `label` + `count`, `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts` (CardHead.count, TableData).

## Tab trạng thái Tất cả / Đang chạy / Xếp hàng / Chờ bạn / Xong / Lỗi
Vì sao: tab lọc hiện cả số 0 (xám); chip hồng chỉ cho việc đang chờ chủ hoặc lỗi. Tab vẫn nằm trong đầu thẻ vì dải đầu đã có tab con Việc đang làm / Lượt chạy; chủ sẽ quyết định chuyển lên dải sau.
Luật: ui-laws.md (Tab counts); suggestion-button-sm không áp dụng.
Grammar: `SurfaceCard headers=[{kind:"filter"}]`, TabItem `count` + `isAttention`, `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`.

## Ô tìm kiếm và bộ lọc Kích hoạt
Vì sao: lọc bảng nằm cùng hàng với tab, trong đầu thẻ; điện thoại thêm ô chọn quy trình.
Luật: ui-laws.md (Tables); canvas-match-pragmatic.
Grammar: `SurfaceCard headers=[{kind:"search", filters:[...]}]`, `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts` (SearchFields). Lỗi còn mở: mũi tên của ô chọn bị phóng to (Grammar).

## Bảng: cột Lượt, Quy trình, Bắt đầu, Thời gian, Kết quả
Vì sao: mỗi lượt là một dòng; "Kết quả" là icon outline kèm chữ, không dùng chip màu; số lượt là liên kết. Cột ngắn (Lượt, Bắt đầu, Thời gian, Kết quả) là fit + một dòng, không bao giờ xuống dòng; chỉ cột Quy trình là fill và cắt bằng dấu ba chấm khi hẹp. Bảng là thẻ trắng kiểu danh sách (không khung xám), nhãn cột 12 muted trên nền trắng, vạch ngăn dòng suốt chiều ngang. Dưới 768 bảng thành danh sách dòng, không tràn thẻ (đã soi ở 390). Đã soi lại với Grammar 0.37.17: OK. Lỗi còn mở ở 390 (Grammar, đầu mục có nhãn + chip đếm): chip rơi xuống dòng dưới và nhãn bị cắt nửa trên (xem 390.png).
Luật: ui-laws.md (Icons: trạng thái là icon outline không tile; Links); memory table-heroui-native-section-head (Table columns: fit/fill, ngắn không xuống dòng; mục SUPERSEDED: thẻ trắng, không khung xám).
Grammar: `TableColumnData` (`width` fill/fit, `truncate`, `priority`), `Link`, icon qua `AgentRunStatusMark`; `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Chân bảng: "Hiển thị 1–10 trên N lượt" + trang
Vì sao: phân trang nằm trong chính thẻ trắng của bảng (vùng footer ngăn bằng vạch vùng, không còn khung xám), tóm tắt bên trái, số trang bên phải; chỉ hiện khi có quá một trang (thấy ở Sales, 12 lượt).
Luật: ui-laws.md (Tables: pagination footer).
Grammar: `SurfaceCard footers=[{kind:"paging", labels.summary}]`, `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts` (FooterZone).

## Trạng thái rỗng
Vì sao: rỗng trên nền hồng là EmptyNotice không khung.
Luật: ui-laws.md (EmptyNotice frameless).
Grammar: `EmptyNotice` trong `SurfaceCard empty`.
