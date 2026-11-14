# Thẻ bước hiện tài khoản

## Chip trên thẻ
Vì sao: nhìn sơ đồ là biết bước nào chạm tài khoản nào: một chip mỗi provider bước dùng ("<tài khoản>"), "<tài khoản> · nhắn khách" cho tài khoản nhắn tin. Không còn đếm lệnh vì không còn lệnh được tích riêng. Bước có `accounts: []` hiện "không dùng provider"; bước chưa khai `accounts` (từ trước thời quyền theo bước) không hiện gì vì chưa biết.
Luật: flowgraph-card-style.md (thẻ n8n, chip nhỏ dưới tiêu đề), badge-dot-or-not.md (chip không chấm).
Grammar: `FlowGraphNode.chips` (tối đa 3, phần còn lại thành "+N").

## Khác bản vẽ
Chip bị cắt "…" theo bề rộng thẻ khi tên tài khoản dài; Grammar chưa cho chip rộng hơn thẻ hay xuống dòng. Chip không có màu riêng cho từng nhà cung cấp (Grammar chỉ có accent / neutral).

Shots missing: ảnh cũ còn chip "· N lệnh", cần chụp lại.

## Ngăn bước: giải thích chỉ đọc (FE-READONLY, 2026-11-14, chưa xem bằng mắt)
Vì sao: thay nhóm "Dữ liệu vào" có ô "Lấy từ": đồ thị của quy trình đúng bằng đồ thị của mẫu nên không còn ô chọn nào. Mỗi nguồn được nói bằng chữ: "Lấy từ: <bước> → <thành viên>" hoặc "Giá trị cố định: ..." (nhãn của gói; thành viên của engine mà gói chưa gắn nhãn đọc từ MỘT danh mục nhỏ: Sự kiện, Kênh liên lạc của khách, Tài khoản kênh, Giờ bắt đầu, Khách; thành viên không có chữ ở đâu cả đọc "Giá trị chưa đặt tên"). Không bao giờ hiện khóa.
Luật: templates.md (cuối trang), type-scale-14-12, no raw key, no-word-matching-code.
Grammar: `SurfaceCard kind="list"` (hàng nhãn 14 / giá trị 14 / dòng phụ 12), `Sublabel`.
Kiểm tra bằng ảnh: ngăn của "Nghe khách" và một bước có "Dữ liệu vào": mọi hàng là chữ, không select, không input; không dòng phụ dưới 12.
