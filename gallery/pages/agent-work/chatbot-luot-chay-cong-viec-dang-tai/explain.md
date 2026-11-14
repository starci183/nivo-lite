---
title: Agent › Công việc › Lượt chạy (đang tải)
route: xem ../chatbot-luot-chay/explain.md
area: agent-work
---
# Agent › Công việc › Lượt chạy: trạng thái đang tải (địa chỉ /agents/chatbot/<id>/work?view=runs)

Ảnh 1440.png và 390.png chụp bằng page.screenshot (không qua wait-ready, vì đây CHÍNH LÀ trạng thái đang tải theo luật `page-loading-own-shape`): thân của `loading.tsx` được vẽ ở một route thử tạm (đã xoá) với địa chỉ thật có `?view=runs`, GraphQL giữ 40 s. So với ảnh đã tải ở ../chatbot-luot-chay.

## Khung trang (đường dẫn, tiêu đề, mô tả, tab, nút chính, đầu pane)
Vì sao: tên agent chưa biết nên là skeleton trong cùng dòng; hàng tab và chữ thật. Thân `AgentWorkAddressBody` đọc `?view=` bằng `useAgentWorkView`, nên vẽ khung bảng Lượt chạy (đúng chữ đầu cột) thay vì khung giếng thẻ công việc mặc định.
Luật: `page-loading-own-shape`, `page-header-left-sublabel-xs`, `nivo-surface-layering`
Grammar: `Page` `isLoading`, `PageHeader` (breadcrumbs và tabs giữ chữ thật), `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`

## Vùng dữ liệu (hàng list, thân chi tiết, số liệu)
Vì sao: các hàng bảng là skeleton của block `AgentRunsPanes`; tiêu đề cột là chữ thật.
Luật: `page-loading-own-shape`
Grammar: `Skeleton`, `node_modules/@starci/grammar/dist/core/leaf/Skeleton/index.d.ts`
