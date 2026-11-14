---
title: Kết nối › tài khoản › Quyền (đang tải)
route: /workspaces/<ws>/connections/open/<id>/rights
area: connections
---
# Đang tải

Vì sao: trang đang tải dựng lại ĐÚNG cây của trang khi đã có dữ liệu (ba thẻ, tên nhóm thật, tab lọc thật, tiêu đề cột thật, ghi chú thật); chỉ dữ liệu (số đếm, hàng) là skeleton, không có màn hình tải chung. Cơ chế: `SlotView` với `placeholder` cùng hình dạng, hàm vẽ nhận `isLoading` và truyền xuống từng ô. Lỗi / cấm do `SlotView` vẽ với nút "Thử lại" gọi lại đúng một lần đọc.
Luật: `page-loading-own-shape`
Grammar: `SlotView` (`@nivo-lite/agent-sdk/client`), `SurfaceCard isLoading`

## Cập nhật 2026-11-13
Không còn chip "luôn hỏi trước" và "chờ chủ duyệt" ở cột "Ai đang giữ": mỗi người giữ chỉ có chế độ của bước (Tự làm | Hỏi trước). Nhãn tốn tiền / không hoàn tác chỉ là thông tin hiển thị. Ảnh cũ chưa chụp lại: shots missing.
