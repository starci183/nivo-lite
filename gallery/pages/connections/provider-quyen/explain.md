---
title: Kết nối › tài khoản › Quyền (Swagger, nhiều quyền)
route: /workspaces/<ws>/connections/open/<id>/rights
area: connections
---
# Trang provider › tab Quyền (chỉ xem)

Ảnh chụp từ câu trả lời mẫu có hình dạng của `providerRightHolders` (29 lệnh, 12 lệnh đọc cho màn hình, không trigger), dựng bằng chính `ProviderRightsTabBase` trên một route thử tạm đã xoá; không có dải đầu trang, không gọi back end. Hình mẫu: `lanes/drawings/provider-rights-tab.png`, đã sửa theo chỉ đạo: tab chỉ xem, KHÔNG có "Sửa", KHÔNG có ngăn kéo; cột "Ai đang giữ" đi xuống tới agent › workflow › bước.

## Ba nhóm là ba thẻ trắng nổi riêng trên nền hồng
Vì sao: mỗi nhóm là một nội dung (bảng), nên mỗi nhóm một thẻ; tên nhóm và chip đếm đứng NGOÀI, phía trên thẻ (hình vẽ đặt trong thẻ, Grammar thắng). Số đếm lấy từ API: nhóm 1 là `counts.all`, nhóm 2 và 3 là số hàng API trả. Dòng mô tả bên phải trong hình thành `note` nhỏ 12 mờ dưới thẻ (thẻ không có mô tả dưới nhãn).
Luật: `pink-page-surface-rule`, `surfacecard-zones-api`, `type-scale-14-12`
Grammar: `SurfaceCard kind="table"` `label` `count` `note`, node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts

## Tab lọc gạch chân "Tất cả · Đang cấp · Chưa cấp · Lệnh ghi"
Vì sao: tab gạch chân là bộ lọc / chế độ xem của thẻ (secondary), số chip lấy từ `counts` do server đếm (không đếm lại ở máy). API trả đủ mọi hàng, nên lọc phía máy trên dữ liệu đã tải: Đang cấp = có ít nhất một bước giữ, Chưa cấp = không bước nào giữ (gồm lệnh chưa mở), Lệnh ghi = lệnh có tác động, đúng nghĩa các số của server.
Luật: `surfacecard-zones-api`
Grammar: `headers=[{kind:"filter"}]`, node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts (FilterFields)

## Cột Quyền · Loại · Ai đang giữ
Vì sao: ô đầu là tên lệnh (14) với dòng code `GET /services/expiring` dưới nó (`Stack` + `Cluster` + `Code`, để code ôm chữ chứ không kéo hết ô). Chip loại nói bằng chữ, không bằng màu: "Đọc", "Ghi", "Ghi · tốn tiền", "Ghi · không hoàn tác". Ô giữ quyền: mỗi người giữ một dòng "agent › workflow › bước" là liên kết plain (màu chữ, tới trang bước) kèm chip chế độ "tự làm / hỏi trước / luôn hỏi trước"; hàng đang chờ chủ ghi "chờ chủ duyệt" (chip mờ, không đỏ); quá 2 người thì có "+N" tính từ dữ liệu, bấm mở ra tại chỗ (không ngăn kéo). Lệnh không ai giữ: "Chưa cấp cho agent nào" (mờ). Lệnh plugin chưa mở: cả hàng mờ và "Chưa mở: plugin chưa đưa lệnh này ra".
Luật: `red-budget-links-foreground`, `badge-dot-or-not`, `row-control-clearance`, `table-heroui-native-section-head`
Grammar: `Badge` (không `isDot`), `Link variant="plain"`, `TextAction appearance="muted"`, `Code`, `Cluster`, `Stack`

## Hàng "22 quyền khác · Xem"
Vì sao: nhóm 1 và 2 hiện 7 hàng đầu; phần còn lại mở ngay trong thẻ qua vùng chân `more` của Grammar. Số lấy từ số hàng API trả trừ số đang hiện.
Grammar: `footers=[{kind:"more"}]`

## Nhóm "Quyền xem trên màn hình" và "Quyền với trigger"
Vì sao: lệnh đọc cho màn hình mang chip "Đọc" và "Mọi thành viên"; lời ghi chú "phân quyền theo vai trò sẽ có sau" nằm trong `note`. Trigger rỗng nói "Provider này chưa có trigger." qua `empty`.

## Điện thoại (390)
Vì sao: bảng tự đổi thành danh sách hàng (`phone` mặc định từ ba cột), tab thừa gập vào "+2".

## Còn khác hình vẽ
(1) Bỏ chữ "Sửa" và ngăn kéo theo chỉ đạo. (2) Tên nhóm và chip đếm nằm trên thẻ, không trong thẻ. (3) Nhãn bước dùng khoá nút (`nodeKey`) vì API chưa trả tên bước; đã báo. (4) Hàng "N quyền khác · Xem" là một dòng liên kết của Grammar, không tách "N quyền khác" bên trái và "Xem" bên phải như hình. (5) Hình không có hàng tiêu đề cột; Grammar luôn vẽ một hàng. (6) Hàng cuối của bảng trigger rỗng ở 390 bị cắt chữ "Provider này chưa có trigger.": khoảng trống Grammar (empty trong bảng hẹp), chưa lách.
Luật: `verify-against-visualize`

## Cập nhật 2026-11-13 (theo `rights.md`)
Tab chỉ xem, mỗi hàng một quyền với người giữ agent › workflow › bước và chế độ của BƯỚC (Tự làm | Hỏi trước). Bỏ hẳn: chip "luôn hỏi trước" (không còn lệnh ép hỏi) và chip "chờ chủ duyệt" (không còn cổng nâng quyền). Chip loại "tốn tiền" / "không hoàn tác" của nhà cung cấp chỉ là thông tin hiển thị (Badge thường, không chấm), không bao giờ đổi chế độ. Ảnh cũ còn các chip đã bỏ: shots missing.
