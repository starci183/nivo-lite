# Sơ đồ: ngăn tham số của khối kết thúc (chatbot)

<!-- shown -->
Màn này đang hiển thị quy trình "Lễ tân" (`front-desk`, Bản 1, 6 bước): Có việc mới, Hiểu ý khách (4 nhánh: Muốn mua, Báo đã chuyển, Hỏi thông tin, Khiếu nại), hai bước Chuyển sang quy trình (sales/consult, accounting/reconcile), Trả lời câu hỏi, Tiếp nhận khiếu nại, Chuyển chủ tiệm.
<!-- /shown -->

## Ngăn tham số mở khi bấm một khối
Vì sao: bấm một khối trên sơ đồ mở ngăn bên phải với tham số rõ ràng của khối đó (khối kết thúc); sửa tham số rồi "Lưu thành bản N" thành bản mới, tham số gán lúc chạy hiện là chip hồng.
Luật: flowgraph-card-style.md (ngăn tham số), workflow-memory-contracts.md (động hay cố định, tham chiếu được kiểm khi lưu), surfacecard-select-subtitle.md.
Grammar: `Drawer` + `SurfaceCard` và `Field` (ngăn của Opus B), node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts.
