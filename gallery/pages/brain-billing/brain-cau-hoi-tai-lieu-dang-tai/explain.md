---
title: Second Brain / Tài liệu / Câu hỏi (đang tải)
route: /workspaces/<ws>/knowledge/<id>/questions
area: brain-billing
---
# Câu hỏi của một tài liệu: đang tải

Shot `1440.png`. Lệnh đọc `BrainCritique` bị giữ 25 giây trong trình duyệt để thấy trạng thái đang tải (dữ liệu giả lập thời gian, không đổi nội dung).

## Dải đầu trang
Vì sao: chữ thật (đường dẫn, tiêu đề, dòng mô tả) vì server biết chúng; chỉ vùng dữ liệu là khung xương.
Luật: `page-loading-own-shape.md`.
Grammar: `Page header isLoading`, `frame/Page/index.d.ts`.

## Thẻ phát hành khi chưa có dữ liệu
Vì sao: thẻ giữ đúng hình thẻ thật (nhãn, hai dòng, nút) với khung xương cùng chiều cao; chữ trong thẻ vẽ từ dòng mẫu cùng hình (số đoạn "0" là chỗ giữ, không phải dữ liệu).
Luật: `page-loading-own-shape.md`, `pink-page-surface-rule.md`.
Grammar: `SurfaceCard isLoading`, `frame/SurfaceCard/index.d.ts`.

## Thẻ nhóm điểm khi chưa có dữ liệu
Vì sao: một nhóm mẫu một điểm cùng hình với điểm thật: tiêu đề, trích dẫn, câu hỏi, lý do, nút; vẽ qua `SlotView` (một cách vẽ trạng thái dữ liệu), không có nhánh tải tự viết.
Luật: `page-loading-own-shape.md`; mã FE-ERROR-1.
Grammar: `SurfaceCard isLoading`, `Quote isLoading`, `SlotView` (`@nivo-lite/agent-sdk/client`).
