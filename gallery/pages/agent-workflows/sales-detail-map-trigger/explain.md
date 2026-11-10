# Sơ đồ: ngăn tham số của khối kích hoạt (sales)

<!-- shown -->
Màn này đang hiển thị quy trình "Tư vấn bán hàng" (`consult`, Bản 1, 5 bước): Có việc mới, Tư vấn khách, Tạo đơn, Gửi QR thanh toán, Báo đội đơn mới.
<!-- /shown -->

## Ngăn tham số mở khi bấm một khối
Vì sao: bấm một khối trên sơ đồ mở ngăn bên phải với tham số rõ ràng của khối đó (khối kích hoạt); sửa tham số rồi "Lưu thành bản N" thành bản mới, tham số gán lúc chạy hiện là chip hồng.
Luật: flowgraph-card-style.md (ngăn tham số), workflow-memory-contracts.md (động hay cố định, tham chiếu được kiểm khi lưu), surfacecard-select-subtitle.md.
Grammar: `Drawer` + `SurfaceCard` và `Field` (ngăn của Opus B), node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts.
