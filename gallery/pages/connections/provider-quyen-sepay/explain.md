---
title: Kết nối › SePay › Quyền
route: /workspaces/<ws>/connections/open/<id>/rights
area: connections
---
# Tab Quyền của một tài khoản SePay

Dữ liệu mẫu: hai lệnh đọc (`nivo.tool.bank.transaction.list`, `.get`), hai lệnh đọc cho màn hình và một trigger `transaction.received` có hai bên giữ. Cùng khuôn với ../provider-quyen (xem bản giải thích ở đó).

## Nhóm "Quyền cho agent" (2)
Vì sao: cùng bảng, các tab lọc giữ số của server (Lệnh ghi · 0: tab hiện số 0 xám, không ẩn). Một lệnh có ba người giữ hiện hai dòng rồi "+1".
Luật: `surfacecard-zones-api`, `type-scale-14-12`
Grammar: `SurfaceCard kind="table"`, `headers filter`

## Nhóm "Quyền với trigger" (1)
Vì sao: mỗi trigger là một hàng; cột "Agent nghe trigger" là các chip "Kế toán · quyết định" và "Gia hạn · nhận thông báo" (vai nói bằng chữ, đều trung tính, không màu cảnh báo). Chưa có tên workflow / bước ở trigger vì API chỉ trả agent và vai.
Luật: `badge-dot-or-not`, `red-budget-links-foreground`
Grammar: `Badge`, `Cluster`

## Còn khác hình vẽ
Hình mẫu SePay (nửa phải bản vẽ) đặt hai nhóm trong cùng nền; ở đây là ba thẻ như mọi provider. Chip trigger là `agent · vai` đúng như hình; hình có "+1" ở hàng đầu vì có bốn người giữ, mẫu của tôi có ba.

## Cập nhật 2026-11-13
Không còn chip "luôn hỏi trước" và "chờ chủ duyệt" ở cột "Ai đang giữ": mỗi người giữ chỉ có chế độ của bước (Tự làm | Hỏi trước). Nhãn tốn tiền / không hoàn tác chỉ là thông tin hiển thị. Ảnh cũ chưa chụp lại: shots missing.
