# Chi tiết lượt chạy lỗi (Chatbot): ngăn kéo tham số của bước, điện thoại 390

## Ngăn kéo "Tham số của bước"
Vì sao: dưới 1280 cột phải thành ngăn kéo; trên điện thoại bấm một bước trong danh sách bước thì ngăn kéo mở ra, nút đóng ở góc.
Luật: ui-laws.md (Responsive: aside becomes a drawer; on phone one pane at a time).
Grammar: `Pane area="aside" collapse="drawer" isOpen onOpenChange closeLabel`; story Pane.

## Tên bước "Phân loại ý định" và loại "Việc làm"
Vì sao: tên bước 14, loại 12 xám, trái.
Luật: ui-laws.md (Type 14/12).
Grammar: `Text`, `Text size="xs" tone="muted"`.

## Nhóm Trạng thái và nhóm Đầu vào (chip 3)
Vì sao: danh sách trên nền trắng là thẻ danh sách có viền (không bóng), mỗi nhóm một khối; mỗi tham số một dòng: tên, nguồn "= trigger.text", giá trị. Giá trị chưa có hiện "—" kèm lời giải thích.
Luật: ui-laws.md (Groups, Surfaces); workflow-memory-contracts.
Grammar: `SurfaceCard kind="list"`, `ListRowData` (title, description, detail); `D:/starci-lanes/nivo-auth-ux/node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Nhóm Kết quả và Nhánh (cuộn xuống)
Vì sao: bước thường không có nhánh rẽ: nhánh duy nhất "Tiếp theo → Có ý định này?" là nhánh đã đi.
Luật: workflow-memory-contracts.
Grammar: `SurfaceCard kind="list" layout="rows"`, `ListRowData.badges`.
