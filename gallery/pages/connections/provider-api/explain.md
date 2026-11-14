---
title: Kết nối › tài khoản › API (khuôn trang provider)
route: /workspaces/<ws>/connections/open/<id>/api
area: connections
---
# Trang provider (một khuôn cho mọi provider) › tab API

Ảnh chụp từ dữ liệu mẫu (câu trả lời mẫu của `providerOffer` cho SePay theo LG-REQUESTS "NODE-RIGHTS D0 output"), dựng bằng chính các Base thật (`ProviderApiTabBase`, dải đầu `connectionBandOf`) trên một route thử tạm đã xoá sau khi chụp; KHÔNG có sidebar/top bar của console và KHÔNG gọi back end thật. Hình mẫu: `lanes/drawings/provider-docs-config.png` phần "Tab API".

## Dải đầu trang (đường dẫn, mark, tên, chip trạng thái, dòng provider, 5 tab)
Vì sao: chrome là nền surface trắng có viền dưới; tab Cấu hình · Quyền · API · MCP · Trigger là tab gạch chân (secondary) đứng trên viền, theo thứ tự của hình; chip "Đã kết nối" không có chấm vì là nhãn kết quả, không phải trạng thái đang chạy. Mỗi tab là một địa chỉ (`/connections/open/<id>[/rights|/api|/mcp|/trigger]`), Cấu hình là chính trang.
Luật: `pink-page-surface-rule`, `surfacecard-zones-api`, `badge-dot-or-not`, `type-scale-14-12`
Grammar: `Page` `header.tabs` (link tabs), `Badge` không `isDot`, node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts; khung dải đầu dùng chung `components/frames/ConnectionBand`

## Dòng dẫn "Lớp 1 · API cho giao diện …"
Vì sao: một câu 12 mờ trên nền hồng nói tab này là gì, như hình vẽ; không phải thẻ.
Luật: `type-scale-14-12`, `pink-page-surface-rule`
Grammar: `Text size="xs" tone="muted"`, node_modules/@starci/grammar/dist/core/leaf/Text/index.d.ts

## Thẻ một lệnh đọc (`sepay:info`)
Vì sao: mỗi lệnh là một thẻ trắng nổi riêng trên nền hồng; vùng đầu thẻ (zone custom) giữ chip loại "Đọc", tên lệnh dạng code, độ tươi ở cuối ("bản đồng bộ, có giờ cập nhật" cho `synced`, "trực tiếp" cho `live`) và câu tóm tắt khi registry có (summary null thì chỉ hiện id, không bịa câu). Thân là bảng của Grammar: một hàng tiêu đề cột (Tên · Kiểu · Ý nghĩa) và một hàng nhóm cho mỗi nhóm (Tham số, Trả về / Trả về mỗi dòng khi shape là `page`). Cột Kiểu là bảng từ đóng trên `type` / `format` / `choices` mà API trả (chuỗi, số nguyên, số, đúng | sai, danh sách …, mã định danh, ngày giờ; lựa chọn đóng nối bằng " | "); giá trị lạ hiện nguyên văn; không suy gì từ tên hay mô tả. Trang này KHÔNG gọi lệnh nó mô tả (chỉ đọc `providerOffer`).
Luật: `table-heroui-native-section-head`, `pink-page-surface-rule`, `badge-dot-or-not`, `type-scale-14-12`
Grammar: `SurfaceCard kind="table"` `headers=[{kind:"custom"}]` `groups`, node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts, node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts (TableData, TableGroupData); `Badge`, `Code`, `Cluster`, `Stack`; mảnh dùng chung `components/composites/ProviderDocList`

## Điện thoại (390)
Vì sao: bảng tự đổi thành danh sách hàng (tên, dưới là kiểu và ý nghĩa) theo `phone="list"`; tab không gập.
Luật: `surfacecard-zones-api`
Grammar: TableData `phone`, node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts

## Trạng thái: rỗng, đang tải, lỗi
Vì sao: cấp rỗng nói "Provider này chưa có API cho giao diện." qua `SlotView` (provider-trigger-chua-co là cùng cách cho Trigger); đang tải dựng lại đúng cây của trang (chữ thật: dòng dẫn, tiêu đề cột; chỉ dữ liệu là skeleton), xem ../provider-api-dang-tai; lỗi / cấm do `SlotView` vẽ, nút "Thử lại" gọi lại đúng một lần đọc `providerOffer`.
Luật: `page-loading-own-shape`
Grammar: `SlotView` (`@nivo-lite/agent-sdk/client`), `PROVIDER_DOC_PLACEHOLDER`

## Còn khác hình vẽ
Đã sửa: (2) cột Kiểu nay là chữ Việt (bảng từ đóng). Hình có lệnh `sepay:transactions`: registry chỉ khai `sepay:info`, hình là minh hoạ (dữ liệu hiện đúng cái registry khai, không thêm). Cột Ý nghĩa trống khi registry chưa có chữ cho lệnh đọc (yêu cầu D0 → workbench-door chưa xong): không bịa. "số nguyên VND" trong hình không suy được từ API (chỉ trả `integer`): hiện "số nguyên".
Khoảng trống Grammar (đã báo, không làm lách): (a) `Code` đo 12.25px, không đúng 12/14; (b) độ tươi ở cuối đầu thẻ ra 14px dù khai `Text size="xs"` trong zone custom; (c) hình đặt hai bảng trong một thẻ, Grammar chỉ cho một tiêu đề cột mỗi bảng và cấm thẻ trong thẻ nên Tham số / Trả về là hai hàng nhóm của một bảng.
Luật: `type-scale-14-12`
Grammar: `Code`, node_modules/@starci/grammar/dist/core/leaf/Code/index.d.ts
