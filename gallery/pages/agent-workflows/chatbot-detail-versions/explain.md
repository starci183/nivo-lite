# Chi tiết quy trình: Phiên bản (chatbot)

<!-- shown -->
Màn này đang hiển thị quy trình "Lễ tân" (`front-desk`, Bản 1, 6 bước): Có việc mới, Hiểu ý khách (4 nhánh: Muốn mua, Báo đã chuyển, Hỏi thông tin, Khiếu nại), hai bước Chuyển sang quy trình (sales/consult, accounting/reconcile), Trả lời câu hỏi, Tiếp nhận khiếu nại, Chuyển chủ tiệm.
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

## Bảng phiên bản
Vì sao: mỗi hàng là một dòng điều hướng (số bản là liên kết thật, chevron ở cuối) mở trang riêng của bản đó ("Bản N so với Bản N−1"), vì diff phức tạp nên là trang chứ không phải ngăn kéo; mỗi lần lưu là một bản mới; bảng gồm Bản, Ngày, Người lưu, Ghi chú, Trạng thái (Đang chạy hoặc Cũ kèm lệnh quay lại bản này), bản mới nhất trước, chip đếm ở đầu thẻ.
Luật: flowgraph-card-style.md (mỗi lần lưu là một bản mới), table-heroui-native-section-head.md (bảng khung xám, đầu = nhãn + chip đếm).
Grammar: `Section` (title, count) + `DataTable` (columns width fit, hideBelow; renderCell; `rows[].href`), `Link`, `Icon`, `TextAction`, `AlertDialog`, node_modules/@starci/grammar/dist/core/branch/DataTable/index.d.ts và node_modules/@starci/grammar/dist/core/frame/AlertDialog/index.d.ts.
