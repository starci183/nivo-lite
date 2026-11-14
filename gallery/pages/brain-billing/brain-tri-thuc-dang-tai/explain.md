---
title: Second Brain › Kiến thức (đang tải)
route: xem ../brain-facts-map/explain.md
area: brain-billing
---
# Second Brain › Kiến thức: trạng thái đang tải (địa chỉ /brain?tab=knowledge&view=facts)

Ảnh 1440.png và 390.png chụp bằng page.screenshot (không qua wait-ready, vì đây CHÍNH LÀ trạng thái đang tải theo luật `page-loading-own-shape`): thân của `loading.tsx` được vẽ ở một route thử tạm (đã xoá) với địa chỉ thật có `?tab=knowledge&view=facts`, GraphQL giữ 40 s. So với ảnh đã tải ở ../brain-facts-map.

## Khung trang (đường dẫn, tiêu đề, mô tả, tab, nút chính, đầu pane)
Vì sao: như Chính sách: tab và view lấy từ địa chỉ, nên dải tab con (Sự thật, Tài liệu, Bài học), tiêu đề "Bộ não của tiệm" và nút chuyển Danh sách / Bản đồ là chữ thật; chỉ hình bản đồ là khối chờ.
Luật: `page-loading-own-shape`, `page-header-left-sublabel-xs`, `nivo-surface-layering`
Grammar: `Page` `isLoading`, `PageHeader` (breadcrumbs và tabs giữ chữ thật), `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`

## Vùng dữ liệu (hàng list, thân chi tiết, số liệu)
Vì sao: vùng bản đồ là skeleton của block, khung chi tiết bên phải giữ câu hướng dẫn thật.
Luật: `page-loading-own-shape`
Grammar: `Skeleton`, `node_modules/@starci/grammar/dist/core/leaf/Skeleton/index.d.ts`
