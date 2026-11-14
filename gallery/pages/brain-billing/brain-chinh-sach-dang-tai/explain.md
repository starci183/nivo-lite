---
title: Second Brain › Chính sách (đang tải)
route: xem ../brain-todo/explain.md
area: brain-billing
---
# Second Brain › Chính sách: trạng thái đang tải (địa chỉ /brain?tab=policies)

Ảnh 1440.png chụp bằng wait-ready ở chế độ "dang-tai" trên địa chỉ thật `?tab=policies` của workspace "Tiệm hoa NIVO (brain test)" (dữ liệu thật; chỉ giữ câu trả lời BrainPolicies 25 s để trạng thái đang tải đứng yên, không đổi dữ liệu). Ảnh 390.png chụp cùng cách. So với ảnh đã tải ở ../brain-chinh-sach.

## Khung trang (đường dẫn, tiêu đề, mô tả, tab, nút chính, đầu pane)
Vì sao: tab của địa chỉ chọn trang nào; `loading.tsx` không đọc được query nên `BrainAddressBody` (client) đọc `?tab=` bằng `useBrainAddressTab`, chọn mô tả đúng tab (đã dịch sẵn ở server) và vẽ đúng block của tab, vì vậy tab "Chính sách" sáng và dòng mô tả là chữ thật ngay từ đầu. Chip số 91 chỉ hiện khi có dữ liệu.
Luật: `page-loading-own-shape`, `page-header-left-sublabel-xs`, `nivo-surface-layering`
Grammar: `Page` `isLoading`, `PageHeader` (breadcrumbs và tabs giữ chữ thật), `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`

## Vùng dữ liệu (hàng list, thân chi tiết, số liệu)
Vì sao: các nhóm quy định là skeleton do block `BrainPolicies` vẽ qua `SlotView` (công thức FE-ERROR-1); app không vẽ skeleton riêng.
Luật: `page-loading-own-shape`
Grammar: `Skeleton`, `node_modules/@starci/grammar/dist/core/leaf/Skeleton/index.d.ts`
