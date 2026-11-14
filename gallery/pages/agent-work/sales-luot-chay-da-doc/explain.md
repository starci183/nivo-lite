# Chi tiết lượt chạy (Sales): thẻ "Đã đọc trong lượt này"

## Nhãn nhỏ "Đã đọc trong lượt này" (12, xám) phía trên thẻ
Vì sao: một nhãn nhóm cỡ 12 nằm trên thẻ, không phải đầu thẻ; thẻ nằm riêng trên nền hồng của giữa trang, mỗi việc một thẻ, giữa sơ đồ và bảng "Gọi AI".
Luật: pink-page-surface-rule; page-header-left-sublabel-xs (nhãn nhóm 12/500 xám); type-scale-14-12; table-heroui-native-section-head (một nội dung một thẻ).
Grammar: `Sublabel` + `SurfaceCard kind="list"`, `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts` (ListData).

## Mỗi dòng: tên sự thật, dòng phụ "Sự thật · bản N · nguồn", giá trị ở cuối
Vì sao: một dòng cho mỗi sự thật agent đã đọc (đọc nhiều lần chỉ một dòng, dòng phụ thêm "đọc N lần"). Tên là "đối tượng · thuộc tính", dòng phụ cỡ 12 xám cho biết bản và nguồn (chủ tiệm chỉnh, tài liệu…), giá trị tiệm đang giữ nằm ở cuối dòng để so với câu agent đã trả lời. Nhãn và giá trị lấy từ đọc Second Brain; id thô không hiện.
Luật: type-scale-14-12; row-control-clearance (p-4 mép thẻ); ui-laws.md (Language: no raw ids); drawings-obey-grammar-laws.
Grammar: `ListRowData` (`title`, `description` là node 12 xám, `value`), `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Dòng "Sự thật đã thay (bản N)" (mờ, không giá trị)
Vì sao: sự thật lượt đã đọc nhưng nay không còn hiệu lực hay chờ duyệt (bị thay bằng bản mới); không có nhãn thì không bịa, dòng mờ nói đúng điều đó.
Luật: ui-laws.md (states: unavailable is muted); unhandled-case-tells-customer (không im lặng).
Grammar: `ListRowData.state="unavailable"`, cùng tệp trên.

## Khi lượt không đọc sự thật nào
Vì sao: không có thẻ (giống bảng "Gọi AI": không có gì thì bỏ hẳn phần). Lượt cũ trước khi hệ thống ghi nhận lần đọc cũng không có thẻ.
Luật: ui-laws.md (một phần không có dữ liệu thì không vẽ khung rỗng); FE-ERROR-1 (SlotView lo đang tải/lỗi).
Grammar: `SlotView` (`@nivo-lite/agent-sdk/client`), thẻ đang tải là hai dòng cùng chiều cao (`SurfaceCard isLoading`).

## Đoạn tài liệu đã đọc (chưa có trên dây, không vẽ)
Vì sao: thiếu ở dữ liệu, không phải ở giao diện: lượt chỉ cho biết đã gọi công cụ tìm/đọc đoạn tài liệu, chưa cho biết đoạn nào. Dòng "Thanh toán và đổi trả · Tài liệu · đoạn 4 · đọc 1 đoạn" của bản vẽ cần `passageReads` ở backend (đã ghi trong LG-REQUESTS, mục FE-LEAD → backend số 3). Không vẽ dòng giả.
Luật: drawings-obey-grammar-laws; không bịa dữ liệu.
Grammar: cùng `ListRowData`.

## Ở 390 (điện thoại)
Vì sao: thẻ giữ nguyên là danh sách một cột; giá trị xuống dưới tên khi dòng hẹp (Grammar tự xếp).
Luật: ui-laws.md (Layout: card full width on phone).
Grammar: `ListRowData.value` (rows list: value wraps under copy on a narrow container).
