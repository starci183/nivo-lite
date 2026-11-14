---
title: Trang dữ liệu của agent (bảng + chi tiết), ví dụ "Yêu cầu gia hạn"
route: /workspaces/<ws>/agents/<module>/<installation>/data/<set>
area: agent-data
---

Trang riêng cho một bộ dữ liệu mà bàn làm việc của agent liệt kê ở khối "Dữ liệu nó đang làm việc trên" (mục "Mở →"). Không phải một tab của bàn làm việc. Các shot chụp từ route tạm với fixture có hình dạng như câu trả lời của CRM (`openapi:nivo.tool.crm.get.renewals-open`, `openapi:nivo.tool.crm.get.renewals-id`); route tạm đã xoá. Spec chạy là spec thử đặt trong route tạm (chưa có spec `data-*` của DESK-CORE): view `core.master-detail` > `core.table` + `core.detail`.
Shots: `1440.png`, `1920.png`, `390.png` (có dữ liệu, trang 1 của 2); `-en` (tiếng Anh); `renewals-chon-dong` (đã chọn một dòng, chi tiết mở); `renewals-dang-tai` (đang tải); `renewals-trong` (đọc được nhưng không có dòng); `renewals-loi` (đọc lỗi); `bo-khong-co` (bộ dữ liệu mà spec không có).
Code: `fe/apps/web/src/features/pages/AgentDataPage/`, `components/blocks/AgentDataBody/`, `hooks/workbenchSpec/useProviderReads.ts`, `modules/workbench-host/provider-reads.ts` (+ `read-freshness.ts`), `modules/workbench-spec/index.ts` (`dataViewOf`), route `app/[locale]/workspaces/[workspaceId]/(console)/agents/[module]/[installation]/data/[set]/`.

## Khung trang: header agent + tab "Bàn làm việc" vẫn chọn
Vì sao: trang dữ liệu nằm dưới agent, nên khung (tên agent, hàng tab) giữ nguyên; tab "Bàn làm việc" vẫn sáng vì đường dẫn `/data/<set>` không thuộc tab nào khác và khung rơi về tab bàn làm việc. Tab đầu tiên đọc "Bàn làm việc" (vi) / "Desk" (en).
Luật: `nivo-compose-architecture` (spec ghép khối chung, web chỉ cấp provider), `complex-content-page-not-drawer` (dữ liệu dài = trang riêng).
Grammar: `Page chrome="panes"` + `PaneGrid`/`Pane inset="flush"` do khung có sẵn (`components/blocks/AgentInstanceFrame`).

## Dòng đầu: "Bàn làm việc" (đường về) và chip độ mới
Vì sao: một liên kết đứng riêng, màu chữ (Link `variant="plain"`, không đỏ: đỏ chỉ dành cho một CTA chính và liên kết trong văn xuôi), dẫn về bàn làm việc. Bên phải một Badge trung tính cho biết dữ liệu "Trực tiếp" hay "Bản đồng bộ · <asOf>"; câu trả lời của cửa đọc nào cũng mang `source` + `asOf`, host gom lại và lấy bản cũ nhất khi có bản đồng bộ. Chip không có chấm (không phải trạng thái sống).
Luật: `red-budget-links-foreground`, `badge-dot-or-not`, `type-scale-14-12`.
Grammar: `Link variant="plain"`, `Badge`, `Cluster`, `PaneSection`.
Khác bản vẽ: bản vẽ chưa có dòng này. Dòng sát mép dưới header (đệm trên nhỏ) và chưa thẳng hàng với tiêu đề khối bảng; sửa khi DESK-CORE chốt header của view `data-*` (xem đề nghị trong LG-REQUESTS).

## Bảng (trái) với phân trang và ô tiền rỗng
Vì sao: `core.table` đọc `openapi:<read>`; hàng và con trỏ `cursor` chảy qua host chung (hook `useWorkbenchGraphqlRead`: `page` -> hàng, `cursor` -> tải thêm); kích cỡ trang do spec (`pageSize`) và API quyết, không có số cứng trong web. Tìm kiếm ghi vào tham số `q`; biến đọc buộc vào `$q` là tuỳ chọn nên danh sách đọc đủ khi chưa gõ gì. Tiền `null` ra ô rỗng, không phải 0 (Grammar vẽ ô rỗng bằng dấu "—").
Luật: `table-heroui-native-section-head` (khung bảng xám native, đầu = nhãn + chip đếm, không mô tả), `type-scale-14-12`.
Grammar: do `core.table` của blocks-core (Grammar `Table` + `Pagination`, `SearchField`).
Khác bản vẽ: các chip trạng thái trong ô vẽ vòng rỗng (Badge có chấm) vì `core.table` format `badge`; luật "chip không chấm" cho nhãn kết quả cần blocks-core sửa (đã ghi đề nghị).

## Chi tiết (phải): chưa chọn / đã chọn
Vì sao: `core.detail` đọc `openapi:...get {id: "$id"}`; biến `$id` là param chọn dòng nên chỉ đọc khi đã chọn một dòng (trạng thái chờ là "Chọn một mục để xem chi tiết"). Đóng bằng nút X xoá param. Tiền `null` ở chi tiết (VAT, tổng của yêu cầu chưa báo giá) để trống.
Grammar: do `core.detail` / `core.master-detail`.
Điện thoại (390): chi tiết gập xuống dưới bảng.

## Đang tải / rỗng / lỗi / bộ dữ liệu không có
Đang tải (`renewals-dang-tai`): tên khối và đầu cột là chữ thật (spec khai), chỉ dữ liệu là skeleton. Rỗng: lời của spec ("Chưa có yêu cầu nào đang mở"). Lỗi: khối nói không tải được và có "Thử lại". Bộ dữ liệu không có (`bo-khong-co`): trang vẫn trong khung agent, EmptyNotice + nút về bàn làm việc; khoá bộ lấy từ địa chỉ, không có danh sách bộ cứng trong web (spec là nguồn: view `data-<set>`).
Luật: `page-loading-own-shape`, `verify-against-visualize`.
