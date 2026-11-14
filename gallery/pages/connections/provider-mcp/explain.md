---
title: Kết nối › tài khoản › MCP (khuôn trang provider)
route: /workspaces/<ws>/connections/open/<id>/mcp
area: connections
---
# Trang provider › tab MCP

Ảnh chụp từ dữ liệu mẫu `providerOffer` (SePay) trên route thử tạm đã xoá; không có sidebar console, không gọi back end. Hình mẫu: `lanes/drawings/provider-docs-config.png` phần "Tab MCP · Lớp 2". Dải đầu, dòng dẫn và bảng: xem ../provider-api/explain.md.

## Dải đầu trang và 5 tab
Vì sao: như ../provider-api (chrome trắng, tab gạch chân, chip không chấm); tab MCP đang chọn.
Luật: `pink-page-surface-rule`, `surfacecard-zones-api`, `badge-dot-or-not`
Grammar: `Page` `header.tabs`, node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts

## Dòng dẫn "Lớp 2 · công cụ cho AI …"
Vì sao: một câu 12 mờ trên nền hồng nói cấp này là gì.
Luật: `type-scale-14-12`
Grammar: `Text size="xs" tone="muted"`, node_modules/@starci/grammar/dist/core/leaf/Text/index.d.ts

## Thẻ một công cụ
Vì sao: chip Đọc/Ghi, id dạng code; công cụ có tham số thì có bảng (Tham số, Trả về); không khai tham số nào thì chỉ còn phần đầu, như `nivo.tool.connection.status.get` trong hình. Tóm tắt / tiêu đề chỉ khi registry khai (câu mô tả tiếng Anh của gateway chỉ là dự phòng nên không dùng; không có chữ thì chỉ hiện id). Với một ghi: dấu tác động là CHỮ trên chip ("Tốn tiền" khi `effect=money`, "Không hoàn tác" khi `irreversible`, không gì khi null); nguy hiểm nói bằng chữ, không bằng màu, và không có màu đỏ nào. Với công cụ Swagger (`operation` không null): dòng METHOD path dạng code, chip "Hỏi trước" chỉ khi `operation.askOnly`; trạng thái khác `ready` làm thẻ mờ (chip loại muted, chữ mờ) kèm lý do ("Tệp Swagger của tài khoản chưa có lệnh này", "Lệnh này dùng phần chưa hỗ trợ: <tên>").
Luật: `pink-page-surface-rule`, `table-heroui-native-section-head`, `badge-dot-or-not`, `red-budget-links-foreground`
Grammar: `SurfaceCard kind="table"` và `SurfaceCard` body, node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts; `Badge` (không `isDot`), `Code`, `Cluster`; mảnh dùng chung `components/composites/ProviderDocList`

## Trạng thái: rỗng, đang tải, lỗi
Vì sao: như ../provider-api (cấp rỗng: "Provider này chưa có công cụ cho AI."; đang tải dựng lại đúng cây trang; lỗi qua `SlotView`).
Luật: `page-loading-own-shape`
Grammar: `SlotView`

## Còn khác hình vẽ
Hình có `since` kiểu "giờ", `limit` "1–50": dữ liệu minh hoạ, API chỉ trả type/format/choices nên "1–50" không hiện. Ý nghĩa trống khi gateway không có chữ song ngữ (chỉ có mô tả tiếng Anh, không dùng). Khoảng trống Grammar như ../provider-api: `Code` 12.25px; hai bảng trong một thẻ.
