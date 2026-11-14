# Chi tiết quy trình: Sơ đồ (accounting)

<!-- shown -->
Màn này đang hiển thị quy trình "Đối soát tiền về" (`reconcile`, Bản 1, 5 bước): Có việc mới, Khớp tiền với đơn, Đánh dấu đã trả, Ghi sổ, Báo đội tiền về.
<!-- /shown -->

Đường dẫn `agents/<loại>/<id>/workflows/<khóa quy trình>` (nhận cả id). Dải tab, đầu trang và các phần đều dùng chung cho bốn phần.

## Đầu trang: tên, bản, trạng thái, lệnh
Vì sao: tên quy trình, dòng "Bản N · số bước · ngày", Badge trạng thái ở đầu; lệnh duy nhất ở cuối hàng là Tạm dừng / Bật lại. Không có lệnh sửa sơ đồ hay thêm bước: sơ đồ là của mẫu và chỉ đọc (2026-11-14).
Luật: header-left-sublabel-xs.md (đầu trang flush trái, sublabel 12), signed-in owner mockup Workflow-Detail/Editor.
Grammar: `PaneHead` (composite của app trên Grammar `PaneHeader`: title, description, status, actions), node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts. Chỉ một Button ở actions, đúng luật PaneHeader.

## Dải tab Vào · Ra, Sơ đồ, Phiên bản, Lượt chạy
Vì sao: bốn phần của một quy trình là tab tầng hai nên nằm ở dải đầu trang màu trắng, ngay dưới dải tab của agent, mỗi phần là một đường dẫn riêng (`/workflows/<khóa>`, `/map`, `/versions`, `/runs`).
Luật: tabs-in-well (tab gạch chân nằm ở dải đầu trang trắng, không nằm trong nền hồng), surfacecard-zones-api.md (gạch chân = tab phụ).
Grammar: `Page` `header.subTabs` do AgentInstanceFrame dựng (`frameSubTabsOf` trong parts.ts), node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts (`PageHeaderTabs`, `subTabs` nằm dưới dải tab của agent) và node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts.

## Sơ đồ và canvas
Vì sao: sơ đồ thẻ trắng kiểu n8n, cạnh cong, cạnh quay lại nét đứt; bấm một bước mở ngăn tham số. Bước có tham số hiện chip: hồng là gán lúc chạy, xám là cố định. Chụp lại 2026-11-11 (Grammar 0.37.33, `FlowGraph height="fill"`): thẻ bước 200×64, tên 14 và dòng phụ 12 ở zoom 1 (đo trong trang), cách nhau 40px; chấm đầu cạnh nằm đúng trên mép phải của thẻ nguồn (tâm chấm lệch mép ≤1px: nửa trên thẻ, nửa ra ngoài, đo ở 1440 và 390); khung graph lấy phần còn lại của trang (519px ở 1440, 599px ở 1920, sàn 360px ở 390); ở 390 zoom 0.8 và kéo ngang. CHƯA ĐẠT ở 1440: đồ thị mở ở zoom 1, thẻ thứ 5 bị cắt mép phải và thẻ cuối nằm ngoài khung (cần zoom khoảng 0.84, trên sàn 0.8); ở 1920 thì vừa. Lỗ hổng Grammar: mở-zoom của `fill` không co để vừa (DNA-COMMON-FLOW-OPEN-ZOOM).
Luật: flowgraph-card-style.md, workflow-memory-contracts.md, single-child-card (sơ đồ đứng một mình, không bọc thẻ). DNA-COMMON-FLOW-OPEN-ZOOM, DNA-COMMON-FLOW-FRAME-FILL, DNA-COMMON-FLOW-START-DOT (đồ thị trên một trang riêng, bản vẽ graph-state.png).
Grammar: `Section` (title, caption) + `FlowGraph layout="steps"` với `FlowGraphNode.chips`, `container` cho bước Lặp qua từng, node_modules/@starci/grammar/dist/core/branch/FlowGraph/types.d.ts (0.37.4, 0.37.5, 0.37.20 cho `fit`). Từ Grammar 0.37.29 sơ đồ vẽ kiểu C: trái sang phải, cạnh vuông góc, chấm ở đầu cạnh, mũi tên tam giác, nền chấm phủ cả khung; thu nhỏ tối thiểu 0.8 nên sơ đồ rộng được kéo (pan) chứ không bị ép nhỏ, bộ nút zoom nằm trong khung. Hệ quả: quy trình thẳng 5-6 bước rộng hơn khung nên bước cuối nằm ngoài mép cho tới khi kéo (ghi cho Grammar). Chụp lại với Grammar 0.37.33: `FlowGraph height="fill"` (trang Sơ đồ), `fit` mở zoom.

## Nền chấm, khối không kéo được
Vì sao: nền chấm kiểu n8n; các khối KHÔNG kéo được vì cửa hàng không bao giờ sửa sơ đồ (không kéo, không lưu vị trí, bố cục là bố cục tự tính); kéo nền để xem, phóng to / thu nhỏ, vừa khung và bấm khối để mở ngăn bước vẫn giữ.
Luật: flowgraph-card-style.md; `templates.md` (cửa hàng không sửa sơ đồ).
Grammar: `FlowGraph background="dots"`, không truyền `isEditable` / `positions` / `onPositionsChange` (`isEditable` là cái bật kéo khối), node_modules/@starci/grammar/dist/core/branch/FlowGraph/index.d.ts.

## Chú giải loại bước và chú thích
Vì sao: chú giải màu các loại bước nằm dưới thẻ, kèm một dòng giải thích.
Luật: flowgraph-card-style.md (màu theo loại).
Grammar: `FlowGraphLegend` đặt dưới `FlowGraph` trong `Section`, node_modules/@starci/grammar/dist/core/branch/FlowGraph/index.d.ts.

## Ngăn của bước: giải thích chỉ đọc, hai thứ shop đặt (FE-READONLY, 2026-11-14, chưa xem bằng mắt)
Vì sao: sơ đồ của một quy trình đúng bằng sơ đồ của gói mẫu, shop không sửa (templates.md, cuối trang), nên bấm một bước mở ngăn GIẢI THÍCH mọi nguồn bằng chữ, mỗi mục là một `Sublabel` + thẻ danh sách các hàng nhãn 14 / giá trị 14 / dòng phụ 12 muted, hàng ngăn nhau bằng đường kẻ full-width: "Bước này làm gì", "Chạy khi nào" (bước kích hoạt: nguồn khởi động; bước chờ: chờ gì và thời hạn), "Dữ liệu vào" ("Lấy từ: <bước> → <thành viên>" hoặc "Giá trị cố định: ..."), "Kết quả trả ra" (nhãn + loại), "Tài khoản bước này dùng", "Công cụ được gọi" (đánh dấu công cụ ghi), "Cách chạy", "Đi tiếp" (từng lối ra → bước đích), "Gọi quy trình" (bước chuyển). Mục không có gì thì không hiện. Chỉ hai thứ shop đặt: Tự chạy / Hỏi trước và tài khoản nào của agent bước dùng. Không select nguồn, không select đích, không ô giá trị, không "Thêm provider", không nút Lưu.
Luật: templates.md (cuối trang: một đồ thị là của mẫu), type-scale-14-12.md, surfacecard-select-subtitle.md (danh sách chọn = SurfaceCard kind=select), no raw key.
Grammar: `Drawer` + `SurfaceCard kind="list"` / `kind="select"` dưới `Sublabel`.
Kiểm tra bằng ảnh: ngăn của "Nghe khách", một bước chờ, một bước chuyển, một bước kết thúc: không control nào sửa đồ thị; chữ 14 / 12; không khóa camelCase; chữ "Giá trị chưa đặt tên" chỉ ở thành viên chưa có nhãn.

## Câu dưới sơ đồ (chú thích của khung)
Vì sao: câu nói đúng sự thật mới: sơ đồ là của mẫu, chỉ đọc, shop chỉ đặt hai thứ (tài khoản nhà cung cấp cho từng bước, cách chạy từng bước) và muốn đổi cách làm thì chờ bản mới của gói. Thay câu cũ "Mỗi quy trình giữ sơ đồ riêng của nó".
Luật: templates.md, type-scale-14-12.md (chú thích 12).
Grammar: `Section caption`.

