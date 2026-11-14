# Chi tiết quy trình: Vào · Ra (accounting)

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

## Thẻ "Bắt đầu khi"
Vì sao: một dòng cho mỗi nguồn kích hoạt, kèm điều kiện và tham số nó cấp; nguồn lấy từ hợp đồng, bản cũ chưa có hợp đồng thì hiện các nguồn của spec bằng tiếng Việt.
Luật: workflow-memory-contracts.md (trigger có nguồn, điều kiện, tham số), page layout rule (thẻ trắng viền nhẹ trên nền hồng, mỗi nhóm một thẻ, nhãn phía trên).
Grammar: `Section kind="list"` với `title`, `count`, `caption`, `items`, `empty`, node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts (luật single-child-card: danh sách đứng một mình là bề mặt).

## Thẻ "Đầu vào bắt buộc" và dòng Cửa vào
Vì sao: bảng tên và tên gọi của các tham số quy trình cần để chạy; quy tắc cửa vào ghi ngay dưới thẻ.
Luật: workflow-memory-contracts.md (hợp đồng đầu vào, cửa vào), table-heroui-native-section-head.md.
Grammar: `Section` (title, count, caption) + `DataTable` (columns, renderCell, emptyContent), node_modules/@starci/grammar/dist/core/branch/DataTable/index.d.ts.

## Thẻ "Kết thúc"
Vì sao: mỗi kết thúc có tên, các giá trị trả ra (chip) và quy trình nó gọi tiếp hoặc "Không gọi tiếp".
Luật: workflow-memory-contracts.md (kết thúc nêu đích chính xác và tham số).
Grammar: `Section kind="list"` với `SectionRow.detail`, node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts.

## Thẻ "Gọi tiếp · <quy trình>"
Vì sao: bảng tham số bàn giao; giá trị động (= trigger.leadId) là chip hồng, giá trị cố định là chip xám, kèm cột "Lấy từ".
Luật: workflow-memory-contracts.md (động hay cố định), owner-colors-exact.md (hồng chính xác của chủ).
Grammar: `Section` (title, fact) + `DataTable`, Badge tone accent/neutral qua WorkflowChips.

## Mục "Nguồn gốc" (FE-READONLY, 2026-11-14, chưa xem bằng mắt)
Vì sao: ở cuối Vào · Ra, một danh sách hàng nhãn / giá trị: Mẫu (tên), Gói (nhãn gói chứa mẫu), Phiên bản (Bản N), và dưới thẻ một câu: sơ đồ này là của gói mẫu, shop dùng nguyên, đổi cách làm thì gói ra bản mới. Quy trình không có mẫu thì không có mục này.
Luật: templates.md (một đồ thị là của mẫu), type-scale-14-12 (câu cuối 12).
Grammar: `Section kind="list"` với `caption`, `ListRowData.value`.
