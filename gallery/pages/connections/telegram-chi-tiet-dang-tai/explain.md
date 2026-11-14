---
title: telegram-chi-tiet (đang tải)
route: xem ../telegram-chi-tiet/explain.md
area: connections
---
# telegram-chi-tiet: trạng thái đang tải (mạng chậm, GraphQL giữ 6 s)

Ảnh 1440.png chụp bằng page.screenshot (không qua wait-ready, vì đây CHÍNH LÀ trạng thái đang tải theo luật `page-loading-own-shape`), 0.5 s sau khi địa chỉ đổi. So với ảnh đã tải ở ../telegram-chi-tiet.

## Khung trang (đường dẫn, tiêu đề, mô tả, tab, nút chính, đầu pane)
Vì sao: `loading.tsx` của route vẽ lại chính block/khung của trang ở trạng thái đang tải, nên phần không cần dữ liệu là chữ thật và đứng đúng chỗ khi dữ liệu về; tên của đối tượng (vd tên agent) là skeleton chữ trong cùng dòng. Chỗ còn nhảy: chip số đếm trên tab (vd "Quyền 1", "Tri thức 91") chỉ hiện khi có dữ liệu nên tab dịch ngang (Grammar Tabs không giữ chỗ cho count chưa biết).
Luật: `page-loading-own-shape`, `page-header-left-sublabel-xs`, `nivo-surface-layering`
Grammar: `Page` `isLoading`, `PageHeader` (breadcrumbs và tabs giữ chữ thật), `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`

## Vùng dữ liệu (hàng list, thân chi tiết, số liệu)
Vì sao: chỉ vùng dữ liệu là skeleton, do block tự vẽ qua `SlotView` (placeholder cùng hình); app không vẽ skeleton riêng. Số hàng skeleton theo budget nên có thể khác số hàng thật.
Luật: `page-loading-own-shape`
Grammar: `Skeleton`, `node_modules/@starci/grammar/dist/core/leaf/Skeleton/index.d.ts`; `SearchField` (`isPending`: ô tìm là chữ thật), `node_modules/@starci/grammar/dist/core/leaf/SearchField/index.d.ts`
