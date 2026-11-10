# Sơ đồ: ngăn tham số của khối kích hoạt (chatbot)

## Ngăn tham số mở khi bấm một khối
Vì sao: bấm một khối trên sơ đồ mở ngăn bên phải với tham số rõ ràng của khối đó (khối kích hoạt); sửa tham số rồi "Lưu thành bản N" thành bản mới, tham số gán lúc chạy hiện là chip hồng.
Luật: flowgraph-card-style.md (ngăn tham số), workflow-memory-contracts.md (động hay cố định, tham chiếu được kiểm khi lưu), surfacecard-select-subtitle.md.
Grammar: `Drawer` + `SurfaceCard` và `Field` (ngăn của Opus B), node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts.
