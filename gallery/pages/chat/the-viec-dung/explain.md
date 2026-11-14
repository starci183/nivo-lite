---
title: Trò chuyện / Thẻ "một việc chạy nền đã dừng" (job.parked)
route: /workspaces/<ws>/chat?room=<id>
area: chat
---
Thẻ NIVO viết vào phòng NIVO khi một việc chạy nền hết lần thử và cần người xem (`ChatMessageType.jobParked`: `job`, `jobId`, `failureClass`, `reason`, `episode`, `since`). FE-WIRE-B, 2026-11-14: type-check, lint và test đơn vị, CHƯA xem bằng mắt, chưa có shot. Trang "Việc cần xử lý" (danh sách) CHƯA làm: bản vẽ của nó đang chờ chủ shop; chỉ có thẻ trong chat.

## Đầu thẻ và Badge
Vì sao: cùng `MessageCard` với thẻ dừng của run và thẻ "việc nền dừng": dấu và tên NIVO, dòng 12 muted "tên việc · giờ", một Badge trung tính KHÔNG chấm ("NIVO báo": nó chỉ báo, không phải trạng thái sống). Tiêu đề nói việc nào đã dừng bằng lời ("Đọc và lập chỉ mục tài liệu đã dừng"); việc app chưa có lời cho thì tiêu đề chung "Một việc chạy nền đã dừng", mã tên việc chỉ nằm trong phần chi tiết gấp.
Luật: `badge-dot-or-not`, `type-scale-14-12`, `no-word-matching-code` (tên việc và loại lỗi tra bảng khai báo, lạ thì lời chung).
Grammar: `MessageCard`, `Badge tone="neutral"`.

## Câu của loại lỗi
Vì sao: dưới tiêu đề một câu 14 nói loại lỗi bằng lời, cùng bảng câu với chip "Cần xử lý" của danh sách tài liệu: input "Không đọc được tệp này", config "Thiếu một kết nối hoặc một cài đặt", transient "Dịch vụ chưa trả lời", code "Lỗi ở phía NIVO"; loại lạ nói "Việc này cần một người xem lại trước khi chạy tiếp".
Luật: `unhandled-case-tells-customer`.

## "Chạy lại", "Đóng" và "Chi tiết"
Vì sao: một hàng nút trung tính sm không icon, KHÔNG đỏ (thẻ báo, người quyết): "Chạy lại" gọi `resumeStoppedWork`; "Đóng" mở ra ô "Vì sao đóng việc này" rồi nút trung tính "Đóng việc này" (`closeStoppedWork` cần lý do) và "Hủy"; "Chi tiết" mở danh sách có viền các mã thô (việc, loại lỗi, lý do, từ lúc). Thẻ của một sự kiện bị chôn (`jobId` dạng `event:<queue>:<event id>`) chỉ có "Chạy lại" và gọi `requeueStoppedEvent` (cửa resume chỉ nhận id của một việc); không có "Đóng". Bấm xong có thông báo nhỏ (đã cho chạy lại / đã đóng / việc không còn chờ) và luồng chat đọc lại.
Luật: `red-budget-links-foreground`, `page-header-left-sublabel-xs` (sm không icon).
Grammar: `Button intent="neutral" size="sm"`, `Input size="sm"`, `TextAction`, `SurfaceCard kind="list" layout="keyValue"`.

## Dòng xem trước trong danh sách phòng
Vì sao: dòng cuối của phòng NIVO trong danh sách nói tiêu đề bằng lời của thẻ, không phải `<việc> · <mã>`.
