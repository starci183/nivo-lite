# Ngăn bước: bước không dùng provider

Bước có `accounts: []` (ví dụ bước chỉ gọi công cụ của NIVO, hoặc bước kết thúc).

## Trạng thái trống
Vì sao: nói thẳng "không dùng provider" thay vì để trống khó hiểu; vẫn có "Thêm provider" (nút nhỏ ở cuối hàng nhãn nhóm); dòng "chỉ chọn được trong N tài khoản agent đã gắn" nằm dưới thẻ danh sách trống. Bước có khai chế độ thì hàng chế độ vẫn hiện (chế độ áp cho công cụ NIVO nó gọi); bước của engine không khai chế độ thì không có hàng nào. Không có nhóm "Quyền thực tế" vì bước không dùng tài khoản nào.
Luật: page-loading-own-shape.md (chữ thật, không khung rỗng), red-budget-links-foreground.md.
Grammar: `Text tone="muted"` (14), `Button size="sm" intent="neutral"` trong `DropdownMenu`.

Shots missing: ảnh cũ chưa vẽ lại sau khi bỏ chế độ theo lệnh.
