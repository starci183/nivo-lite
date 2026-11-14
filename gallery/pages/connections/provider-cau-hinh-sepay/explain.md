---
title: Kết nối › SePay › Cấu hình (một mặt phẳng: biểu mẫu Kết nối)
route: /workspaces/<ws>/connections/open/<id>
area: connections
---
# Trang provider › tab Cấu hình, tài khoản SePay

Ảnh chụp trang thật ở chế độ prototype với câu trả lời mẫu có hình dạng như thật (`connectionFields` của D0, `providerTriggerStates`, `sepayConnection`); phần mẫu tạm đã xoá. Hình mẫu: `lanes/drawings/provider-docs-config.png`, tab Cấu hình. Biến thể: `-chinh-thuc` (chọn "Chính thức" rồi "Lưu": hộp xác nhận), `-da-sua` (ảnh cũ trước khi gấp các bước).

## Thẻ "Kết nối" là mặt phẳng duy nhất để sửa
Vì sao: mọi trường sửa được nằm một chỗ: tên hiển thị, địa chỉ webhook (chỉ đọc, có sao chép), ngân hàng (ô chọn tìm được, danh sách từ API), số tài khoản, chủ tài khoản, môi trường (chọn "Chính thức" thì hỏi trước khi "Lưu" gửi, lời hỏi lấy từ API), khoá API (ô trống, niêm phong). Lời dưới thẻ và dưới từng trường là của API (khoá của danh mục lời web). Bước "Chọn môi trường", bước "Tài khoản ngân hàng", thẻ "Thông tin kết nối" (chỉ giữ lại webhook đã nhận) và nút "Chuyển sang Chính thức" đã gỡ.
Luật: `red-budget-links-foreground` (nút đỏ duy nhất của trang là "Lưu"), `type-scale-14-12`, `row-control-clearance`
Grammar: `SurfaceCard`, `Grid kind="form"`, `Input`, `ComboBox`, `Select`, `AlertDialog`

## Ba bước còn lại: làm theo trên SePay, kiểm tra, agent đọc giao dịch
Vì sao: không có trường nào của kết nối thay được chúng (khoá hiện / tạo mới, danh sách kiểm tra, agent). Bộ chỉ tiến độ chỉ còn 3 mốc nên nhãn không còn chồng nhau ở 1440 / 1920.

## Còn khác hình vẽ
- Công tắc bật tô đỏ (Grammar `Switch` không có tông trung tính).
- Ô chọn ngân hàng không có logo: `ComboBox` / `Select` của Grammar không có biểu tượng cho từng lựa chọn (bản cũ cũng không có).
- Nút "Kiểm tra kết nối" không hiện ở SePay vì mẫu đặt `canTest: false`.
- Nút xác nhận của hộp hỏi tô màu nhấn (không phải nguy hiểm): nằm trong lớp hộp riêng, không tính vào trang.
- Body của bước "Làm theo trên SePay" vẫn hiện địa chỉ webhook (cùng giá trị với trường chỉ đọc): chưa gỡ vì cùng thẻ có khoá hiện / tạo mới.
- Input của Grammar không có `maxLength`: giới hạn của API được kiểm, không chặn gõ.
