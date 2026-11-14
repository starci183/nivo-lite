---
title: Kết nối › tài khoản › API (đang tải)
route: /workspaces/<ws>/connections/open/<id>/api
area: connections
---
# Trang provider › API: trạng thái đang tải

Ảnh dựng từ `ProviderApiTabBase` với slot `isLoading` trên route thử tạm (đã xoá); route thật có `api/loading.tsx` vẽ đúng block này.

## Dải đầu trang và 5 tab
Vì sao: chrome là chữ thật ngay (đường dẫn, tên, tab), chỉ dữ liệu là khung xương. Trong route thật dải đầu do layout giữ và đọc kết nối riêng.
Luật: `page-loading-own-shape`, `pink-page-surface-rule`
Grammar: `Page` `isLoading`, node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts

## Dòng dẫn và hai thẻ xương
Vì sao: dòng dẫn là chữ thật; mỗi thẻ giữ hình của thẻ thật (đầu thẻ, tiêu đề cột thật Tên · Kiểu · Ý nghĩa, hàng xương) nhờ SlotView vẽ cây thật với dữ liệu giả `PROVIDER_DOC_PLACEHOLDER`.
Luật: `page-loading-own-shape`
Grammar: `SurfaceCard` `isLoading`, `Skeleton`, node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts
