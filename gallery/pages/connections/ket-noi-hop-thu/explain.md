---
title: Kết nối với hộp thư IMAP và SMTP
route: /workspaces/<ws>/connections
area: connections
---
Route `/workspaces/<ws>/connections`. Bản vẽ: `mail-as-provider.png` phần 1. Shot MOCKED: dev chưa có kết nối IMAP/SMTP nên ba hàng (hai hộp thư, một SMTP) được thêm vào câu trả lời `connections` bằng `ctx.route`; các hàng còn lại là thật. Chỉ nhãn đổi, không có màn mới.

## Hàng hộp thư IMAP: tên là địa chỉ, dòng phụ "Hộp thư (IMAP)"
Vì sao: hộp thư nằm cùng danh sách tài khoản như Zalo, SePay, Google: tên là địa chỉ, dòng phụ là loại ("Hộp thư (IMAP)", trước đây "Hộp thư email (IMAP)") rồi các thông tin nhận diện. Dòng phụ nối thêm địa chỉ thư vì mọi hàng của một kết nối dữ liệu đều có dòng nhận diện; trùng với tên, nhưng là khuôn chung. Chip trạng thái là "Đang chạy" như mọi kết nối đã nối (bản vẽ ghi "Đã kết nối"): chữ này thuộc khuôn hàng chung.
Luật: `type-scale-14-12`, `table-heroui-native-section-head`.
Grammar: `Table` hàng với `IdentityLockup` (`composite/Table`, `composite/IdentityLockup`); app `connectionsPanes.shared.ts` (`identityOf`), khóa `provider_imap_title`.

## Hàng SMTP: dòng phụ "Gửi mail (SMTP)"
Vì sao: cùng khuôn; nhãn "Email gửi đi" cũ đổi thành "Gửi mail (SMTP)" để hai nhãn thư đọc song song với IMAP; cùng khóa còn dùng cho tiêu đề trình hướng dẫn kết nối.
Luật: `type-scale-14-12`.
Grammar: như trên; khóa `provider_smtp_title`.
