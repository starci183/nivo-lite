# Chi tiết quy trình: trang một bản, bản đầu tiên (sales)

<!-- shown -->
Màn này đang hiển thị trang của "Bản 1" của quy trình "Tư vấn bán hàng" (`consult`): đường dẫn `workflows/consult/versions/1`, bản đầu tiên nên không có gì để so.
<!-- /shown -->

## Dải đường dẫn (breadcrumb)
Vì sao: trang chi tiết một bản là trang riêng (diff phức tạp thì thành trang, không phải ngăn kéo), nên đường dẫn dài thêm "Quy trình / Bản 1" để quay về danh sách bản; hàng sub-tab của quy trình ẩn vì đường dẫn đã mang đường về.
Luật: complex-content-page-not-drawer, page-header-left-sublabel-xs.
Grammar: `Page header.breadcrumbs` do AgentInstanceFrame dựng (`versionCrumbOf` trong parts.ts), node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts.

## Đầu trang: "Bản 1 · bản đầu tiên"
Vì sao: tiêu đề nói bản nào; dòng 12 mờ dưới tiêu đề nói "Bản đầu tiên, chưa có bản trước để so" thay cho tóm tắt +x bước · −y bước · z đổi, vì bản đầu tiên không phải "thêm" gì (chủ: bản đầu thì không phải thêm gì, gây hiểu nhầm).
Luật: header-left-sublabel-xs.md (đầu trang flush trái, sublabel 12), verified-against-visualize.
Grammar: `PaneHead` (composite của app trên `PaneHeader`), node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts.

## Thẻ "Sơ đồ"
Vì sao: một việc một thẻ trắng nổi trên nền hồng; với bản đầu tiên chỉ có thẻ sơ đồ, vẽ trơn, không đánh dấu thêm/bỏ/đổi, không có thẻ "Các bước" hay "Quyền và công cụ". Bản từ thứ hai trở đi thêm hai thẻ danh sách theo kiểu GitHub (+ xanh, − đỏ gạch ngang, ~ vàng kèm cũ → mới) rồi thẻ sơ đồ có bước được tô màu.
Luật: surfacecard-zones-api.md, flowgraph-card-style.md, nivo-surface-layering (thẻ trắng trên nền hồng).
Grammar: `SurfaceCard` (body và `kind="list"` với `ListRowData.diff`, `change`, `diffLabel` từ 0.37.28), `FlowGraph fit="contain"` kiểu C (0.37.27, 0.37.29), node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts và node_modules/@starci/grammar/dist/core/branch/FlowGraph/index.d.ts. Chưa chụp được trang của bản thứ hai vì dữ liệu dev chỉ có Bản 1.
