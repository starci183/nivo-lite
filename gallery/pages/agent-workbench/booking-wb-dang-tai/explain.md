---
title: Booking › Bàn làm việc › Hôm nay (đang tải)
route: bàn làm việc Booking (chưa có thư mục đã tải)
area: agent-workbench
---
# Booking › Bàn làm việc › Hôm nay: trạng thái đang tải (địa chỉ /agents/booking/<id>/workbench?tab=today)

Ảnh 1440.png và 390.png chụp bằng page.screenshot (không qua wait-ready, vì đây CHÍNH LÀ trạng thái đang tải theo luật `page-loading-own-shape`): thân của `loading.tsx` được vẽ ở một route thử tạm (đã xoá) với địa chỉ thật có `?tab=today`, GraphQL giữ 40 s.

## Khung trang (đường dẫn, tiêu đề, mô tả, tab, nút chính, đầu pane)
Vì sao: một loại agent không có spec dùng bàn làm việc riêng (Booking): cùng cách chọn theo địa chỉ, nên dải sub-tab Lịch / Hôm nay / Danh sách chờ / Thống kê / Thiết lập và nhãn bốn ô số liệu là chữ thật. Ảnh dùng id cài đặt của chatbot với loại booking, chỉ để vẽ khung.
Luật: `page-loading-own-shape`, `page-header-left-sublabel-xs`, `nivo-surface-layering`
Grammar: `Page` `isLoading`, `PageHeader` (breadcrumbs và tabs giữ chữ thật), `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`

## Vùng dữ liệu (hàng list, thân chi tiết, số liệu)
Vì sao: số liệu, dòng trạng thái và danh sách hẹn là khối chờ do block `BookingWorkbench` vẽ.
Luật: `page-loading-own-shape`
Grammar: `Skeleton`, `node_modules/@starci/grammar/dist/core/leaf/Skeleton/index.d.ts`
