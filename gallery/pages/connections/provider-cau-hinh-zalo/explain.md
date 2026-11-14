---
title: Kết nối › Zalo OA › Cấu hình
route: /workspaces/<ws>/connections/open/<id>
area: connections
---
# Trang provider › tab Cấu hình, tài khoản Zalo OA
Ảnh chụp trang thật ở chế độ prototype, câu trả lời mẫu như D0 (đã xoá). Thẻ "Kết nối": tên hiển thị, tên OA, OA ID, App ID (chỉ đọc, kèm lời), địa chỉ webhook (sao chép), OA Secret Key (ô trống, tối thiểu / tối đa từ API, lời khi chưa lưu). Đã gỡ: bước "Khoá ứng dụng" và phần dán khoá OA / địa chỉ webhook của bước "Thiết lập ứng dụng Zalo", cùng phần "khoá đã lưu" của thẻ thông tin. Giữ nguyên: địa chỉ callback (cả workspace), cấp quyền / kết nối lại, kiểm tra + gửi thử, mẫu ZNS, thẻ sức khoẻ (token, khách nhắn, agent). "Kiểm tra kết nối" hiện vì `canTest`.
Còn khác hình vẽ: công tắc đỏ (Grammar); phần sự kiện báo "Chưa có sự kiện" vì mẫu không có sự kiện Zalo; bộ chỉ tiến độ 4 mốc gọn trong cột.
