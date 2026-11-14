# Ngăn bước: chế độ của bước và các provider nó dùng (Gửi lời nhắc)

Mở bằng cách bấm một thẻ bước trên sơ đồ workflow, hoặc theo địa chỉ `…/workflows/<khóa>/map?step=<node>` (các bảng tổng hợp quyền trỏ vào đây). Cập nhật 2026-11-13 theo `rights.md`: MỘT chế độ cho cả bước (`auto | ask`), không còn tích từng lệnh, không còn hàng riêng cho lệnh tốn tiền. Ảnh cũ trong thư mục vẽ ngăn theo từng lệnh: CHƯA vẽ lại (shots missing).

## Khối "Cách chạy" (cập nhật 2026-11-14, FE-NODEMODE, CHƯA chụp lại ảnh)
Vì sao: một chế độ cho cả bước (`auto | ask`) do CHỦ shop đặt trên bản quy trình của chính shop: "Tự chạy" (agent tự làm bước này) hoặc "Hỏi trước" (bước dừng, hỏi chủ trong /chat, cho xem trọn tin nhắn hoặc việc sắp làm rồi mới chạy). Khối nằm trên nhóm tham số, KHÔNG còn nằm trong phần quyền provider. Chọn giá trị kia gọi ngay `setAgentNodeMode` (kèm `expectedLatest` là bản trang đã đọc): viết MỘT bản mới của quy trình chỉ đổi chế độ của bước đó, rồi trang đọc lại và hiện bản mới, toast "Đã đổi cách chạy của bước. Áp dụng cho lượt chạy mới." Nếu trong lúc đó có người xuất bản bản mới (lỗi `AGENT_GRAPHS_WORKFLOW_CONFLICT`), trang đọc lại và nói bằng lời thường rằng chưa đổi được. Một dòng 12 mờ dưới khối: các lượt đang chạy giữ cách chạy cũ. Không có nút chính nào trong khối (không đỏ).
Ai thấy gì: chủ shop thấy hai hàng chọn; quản lý và nhân viên thấy chế độ hiện tại là chữ (thẻ chi tiết một hàng) kèm dòng 12 mờ "Chỉ chủ shop đổi được." Ẩn hẳn ở thẻ trigger, các bước của engine (rẽ nhánh, chờ, lặp, trả lại tin, kết quả: không khai chế độ) và ngăn của một lượt chạy (đó là tham số lượt chạy đã dùng).
Luật: `surfacecard-select-subtitle` (mọi danh sách lựa chọn là SurfaceCard kind=select, hàng Checkbox HeroUI, vạch ngăn full-width, kiểu checkbox dù chọn một; chú thích 12 mờ là `subtitle` của hàng, không phải dòng lẻ), `type-scale-14-12`, `red-budget-links-foreground` (trang không có CTA chính ở khối này), `provider-rights-abilities` (một `auto|ask` mỗi bước, chủ shop đặt), `complex-content-page-not-drawer` (một lựa chọn ngắn nên ở ngăn).
Grammar: `SurfaceCard kind="select" selectionMode="single"` (`sublabel` là nhãn "Cách chạy", `items[].subtitle`), `SurfaceCard kind="details"` cho bản chỉ đọc, `Text size="sm" tone="muted"` cho hai dòng ghi chú. Thay cho pill `headers=[{kind:"switch"}]` cũ (bản nháp sửa cùng bước Lưu thành bản N): nay chế độ đi một đường riêng và có hiệu lực ngay, không qua bản nháp.
Bước có provider nhưng chưa khai chế độ (graph lưu từ trước): không có khối, thay bằng một dòng mờ "Bước này chưa khai cách chạy…" ở phần provider và chip "Chưa khai chế độ" ở nhóm quyền thực tế (engine không có mặc định nên không được nói "Hỏi trước").

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
