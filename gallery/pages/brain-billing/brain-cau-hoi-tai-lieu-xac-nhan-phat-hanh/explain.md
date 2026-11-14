---
title: Second Brain / Tài liệu / Câu hỏi (hộp xác nhận phát hành)
route: /workspaces/<ws>/knowledge/<id>/questions
area: brain-billing
---
# Hộp xác nhận "Phát hành" (đang mở, chưa bấm xác nhận)

Shots `1440.png`, `390.png`, dữ liệu giả lập như `brain-cau-hoi-tai-lieu-mau` (1 đoạn chờ soát, 2 đoạn đang giữ). Chỉ mở hộp, không bấm "Phát hành" trong hộp.

## Hộp xác nhận
Vì sao: phát hành là việc cho khách đọc, cần xác nhận nên là `AlertDialog` (nút "Để sau" trước và được focus đầu, nút xác nhận sau cùng). Lời nói đúng việc: CHỈ đoạn đang chờ NIVO soát được đưa cho khách, đoạn còn điểm chưa trả lời vẫn giữ cho tới khi trả lời hoặc bỏ qua; không bao giờ nói "tất cả đoạn" (INGEST-SEAM mục 1). Hộp có biểu tượng thông tin vì đây là xác nhận trung tính, không phải xoá; nút xác nhận là nút chính của hộp.
Luật: CTA-4 và `ui/components/dialog-drawer.md` (dòng confirm), `red-budget-links-foreground.md`.
Grammar: `AlertDialog tone="informative"` với `trigger`, `core/frame/AlertDialog/index.d.ts`; story `Frame/AlertDialog`.

## Phần trang phía sau hộp
Vì sao: phủ mờ của hộp; trang không đổi, xem `brain-cau-hoi-tai-lieu-mau`.
Luật: `pink-page-surface-rule.md`.
Grammar: `Page`, `SurfaceCard`.
