# Ngăn bước: chế độ của bước và các provider nó dùng (Gửi lời nhắc)

Mở bằng cách bấm một thẻ bước trên sơ đồ workflow, hoặc theo địa chỉ `…/workflows/<khóa>/map?step=<node>` (các bảng tổng hợp quyền trỏ vào đây). Cập nhật 2026-11-13 theo `rights.md`: MỘT chế độ cho cả bước (`auto | ask`), không còn tích từng lệnh, không còn hàng riêng cho lệnh tốn tiền. Ảnh cũ trong thư mục vẽ ngăn theo từng lệnh: CHƯA vẽ lại (shots missing).

## Hàng "Bước này làm việc thế nào"
Vì sao: bước tự khai cách nó gọi công cụ: Tự làm (chạy ngay) hoặc Hỏi trước (dừng, thẻ duyệt trong /chat, rồi mới chạy). Một viên chọn hai giá trị cho cả bước; nhãn nói rõ "một chế độ cho cả bước". Bước của engine (kết thúc, gọi workflow khác, rẽ nhánh) không khai chế độ nên không có hàng này.
Luật: `surfacecard-zones-api` (pill = chế độ chính, 2 giá trị), `row-control-clearance` (hàng cao lên quanh điều khiển), `type-scale-14-12`.
Grammar: `SurfaceCard kind="list"` không hàng, vùng đầu `headers=[{kind:"switch"}]` (pill 2 giá trị Tự làm | Hỏi trước, tiêu đề mờ ở đầu hàng) và `note` là dòng nói mỗi giá trị làm gì.
Bước có provider nhưng chưa khai chế độ (graph lưu từ trước khi mỗi bước khai một chế độ): không có pill, thay bằng một dòng mờ "Bước này chưa khai chế độ…" và chip "Chưa khai chế độ" ở nhóm quyền thực tế (engine không có mặc định nên không được nói "Hỏi trước").

## Nhóm "Provider bước này dùng"
Vì sao: bước dùng provider nào, theo thứ tự thử (ToolRunner thử theo dữ liệu rồi theo thứ tự này). Mỗi hàng một tài khoản đã gắn cho agent: tên, nhà cung cấp, nút trung tính cỡ sm "Bỏ" ở cuối hàng. "Thêm provider" là nút trung tính sm ở CUỐI hàng nhãn của nhóm (bản vẽ `pill-and-head`, không nằm riêng một dòng); nó chỉ liệt kê tài khoản agent đã gắn mà bước chưa dùng, còn dòng "chỉ chọn được trong N tài khoản agent đã gắn" (N từ API) là `note` dưới thẻ danh sách. Dòng gợi ý dưới nhãn nhóm và dòng này là chữ 14 mờ (câu gợi ý, không phải tên nhỏ). Chỉ sửa bản nháp; xuất bản mới có hiệu lực. Không còn cổng "chờ chủ duyệt": xuất bản không bị chặn vì quyền.
Luật: `red-budget-links-foreground` ("Bỏ", "Thêm provider" là nút trung tính sm, không đỏ, không icon), `suggestion-button-sm`.
Grammar: `SurfaceCard kind="list"` (`action intent="neutral"`, `actionPlacement="end"`, `note`), `DropdownMenu` + `Button size="sm"`.

## Nhóm "Quyền thực tế của bước này"
Vì sao: chỉ đọc; mỗi provider của bước hiện chế độ của bước nếu agent có tài khoản đó, hoặc "Không: agent chưa gắn" (gỡ tài khoản là công tắc ngắt: không tài khoản, không công cụ). Tính từ cùng dữ liệu, không truy vấn thêm.
Luật: `pink-page-surface-rule` (nằm trong ngăn trắng), `badge-dot-or-not`.
Grammar: `SurfaceCard kind="list"`, `ListRowData.value` = `Badge`, `state="unavailable"` cho hàng "Không".

## Khác bản vẽ (và vì sao)
- Bản vẽ cũ có ô tích cho từng lệnh với viên Tự làm / Hỏi trước mỗi hàng, hàng "Luôn hỏi trước" cho lệnh tốn tiền, và "N lệnh khác của tài khoản này": bỏ hết theo `rights.md` (một chế độ cho cả bước, không lớp tiền, không `never`). Nhãn "tốn tiền" / "không hoàn tác" của nhà cung cấp chỉ còn là thông tin hiển thị ở trang provider, không đổi chế độ.
- Hai nhóm xếp dọc trong ngăn bên phải (ngăn hẹp 480px).

Shots missing: 1440 / 390 của ngăn với bước `auto`, bước `ask`, bước kết thúc (không chế độ), bước có tài khoản agent chưa gắn.
