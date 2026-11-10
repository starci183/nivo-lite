# Sơ đồ: thêm bước (chatbot)

<!-- shown -->
Màn này đang hiển thị quy trình "Lễ tân" (`front-desk`, Bản 1, 6 bước): Có việc mới, Hiểu ý khách (4 nhánh: Muốn mua, Báo đã chuyển, Hỏi thông tin, Khiếu nại), hai bước Chuyển sang quy trình (sales/consult, accounting/reconcile), Trả lời câu hỏi, Tiếp nhận khiếu nại, Chuyển chủ tiệm.
<!-- /shown -->

## Ngăn chọn loại bước sau khi bấm "Thêm bước"
Vì sao: thêm một bước là sửa sơ đồ nên mở cùng ngăn tham số của bước, ở bước chọn loại; bước mới chèn sau bước đang chọn (hoặc bước cuối) và chỉ thành bản mới khi bấm "Lưu thành bản N".
Luật: flowgraph-card-style.md (người dùng sửa sơ đồ, Lưu thành bản N), workflow-memory-contracts.md (tham chiếu được kiểm khi lưu).
Grammar: `Drawer` + `SurfaceCard` (ngăn tham số của Opus B), node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts; lệnh `StepAction add` trong modules/types/workflowSteps.ts.
