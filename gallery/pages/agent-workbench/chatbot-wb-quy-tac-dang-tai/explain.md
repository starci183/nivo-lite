---
title: Chatbot › Bàn làm việc › Quy tắc (đang tải)
route: xem ../chatbot-wb-quy-tac/explain.md
area: agent-workbench
---
# Chatbot › Bàn làm việc › Quy tắc: trạng thái đang tải (địa chỉ /agents/chatbot/<id>/workbench?tab=rules)

Ảnh 1440.png và 390.png chụp bằng page.screenshot (không qua wait-ready, vì đây CHÍNH LÀ trạng thái đang tải theo luật `page-loading-own-shape`): thân của `loading.tsx` được vẽ ở một route thử tạm (đã xoá) với địa chỉ thật có `?tab=rules`, GraphQL giữ 40 s. So với ảnh đã tải ở ../chatbot-wb-quy-tac.

## Khung trang (đường dẫn, tiêu đề, mô tả, tab, nút chính, đầu pane)
Vì sao: bố cục bàn làm việc chọn theo loại agent trên server nên `loading.tsx` không biết; `AgentWorkbenchLoadingBody` đọc loại và `?tab=` từ địa chỉ (`useAgentRoute`) và chọn đúng bố cục như trang (spec của chatbot), nên dải sub-tab, nhãn ô nhập, câu giới hạn 400 ký tự và nút Huỷ là chữ thật.
Luật: `page-loading-own-shape`, `page-header-left-sublabel-xs`, `nivo-surface-layering`
Grammar: `Page` `isLoading`, `PageHeader` (breadcrumbs và tabs giữ chữ thật), `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`

## Vùng dữ liệu (hàng list, thân chi tiết, số liệu)
Vì sao: ô nhập, nút lưu và các thẻ "Cần bạn duyệt" là khối chờ do khung spec vẽ.
Luật: `page-loading-own-shape`
Grammar: `Skeleton`, `node_modules/@starci/grammar/dist/core/leaf/Skeleton/index.d.ts`
