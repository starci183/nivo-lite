---
title: Kết nối › tài khoản › Quyền (lệnh chưa mở, chưa cấp)
route: /workspaces/<ws>/connections/open/<id>/rights
area: connections
---
# Lệnh chưa ai giữ và lệnh plugin chưa mở

Dữ liệu mẫu: một lệnh đã cấp, một lệnh ghi chưa ai giữ, một lệnh "Ghi · không hoàn tác" mà plugin chưa đưa ra (`open: false`).

## Hàng chưa mở
Vì sao: cả hàng mờ (tên, chip loại, dòng giải thích) và nói thẳng "Chưa mở: plugin chưa đưa lệnh này ra"; không có liên kết, vì không có bước nào. Mức nguy hiểm vẫn nói bằng chữ trên chip ("Ghi · không hoàn tác"), không bằng màu.
Luật: `red-budget-links-foreground`
Grammar: `Text tone="muted"`, `Badge tone="muted"`

## Hàng chưa cấp
Vì sao: "Chưa cấp cho agent nào" mờ ở cột giữ quyền; hàng này đếm trong tab "Chưa cấp".
Grammar: `SurfaceCard kind="table"`

## Còn khác hình vẽ
Hàng "Xoá một phiếu" trong hình có tên mờ nhưng code không mờ; `Code` của Grammar không có tông mờ, khoảng trống đã báo.

## Cập nhật 2026-11-13
Không còn chip "luôn hỏi trước" và "chờ chủ duyệt" ở cột "Ai đang giữ": mỗi người giữ chỉ có chế độ của bước (Tự làm | Hỏi trước). Nhãn tốn tiền / không hoàn tác chỉ là thông tin hiển thị. Ảnh cũ chưa chụp lại: shots missing.
