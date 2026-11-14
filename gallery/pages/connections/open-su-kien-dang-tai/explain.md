---
title: Chi tiết kết nối (mở) › Sự kiện (đang tải)
route: xem ../payos-chi-tiet-open/explain.md
area: connections
---
# Chi tiết kết nối (mở) › Sự kiện: trạng thái đang tải (địa chỉ /connections/open/<id>?view=events)

Ảnh 1440.png và 390.png chụp bằng page.screenshot (không qua wait-ready, vì đây CHÍNH LÀ trạng thái đang tải theo luật `page-loading-own-shape`): thân của `loading.tsx` được vẽ ở một route thử tạm (đã xoá) với địa chỉ thật có `?view=events`, GraphQL giữ 40 s. So với ảnh đã tải ở ../payos-chi-tiet-open.

## Khung trang (đường dẫn, tiêu đề, mô tả, tab, nút chính, đầu pane)
Vì sao: dải đầu và tab do layout giữ và đã đọc địa chỉ; thân `ConnectionOpenAddressBody` đọc cùng `?view=` bằng `useConnectionOpenAddress`, nên tab "Sự kiện" sáng và thân là danh sách sự kiện, không còn rơi về thân của tab Tổng quan.
Luật: `page-loading-own-shape`, `page-header-left-sublabel-xs`, `nivo-surface-layering`
Grammar: `Page` `isLoading`, `PageHeader` (breadcrumbs và tabs giữ chữ thật), `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`

## Vùng dữ liệu (hàng list, thân chi tiết, số liệu)
Vì sao: danh sách sự kiện là skeleton của block `ConnectionOpenEvents`; tên kết nối và logo chưa biết nên là khối chờ.
Luật: `page-loading-own-shape`
Grammar: `Skeleton`, `node_modules/@starci/grammar/dist/core/leaf/Skeleton/index.d.ts`
