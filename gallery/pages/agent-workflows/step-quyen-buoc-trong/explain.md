# Ngăn bước: bước không dùng provider

Bước có `accounts: []` (ví dụ bước chỉ gọi công cụ của NIVO, hoặc bước kết thúc).

## Trạng thái trống (đổi 2026-11-14)
Vì sao: nói thẳng bằng một dòng 12 muted "Bước này không dùng tài khoản của nhà cung cấp nào." thay vì để trống; không có danh sách chọn, không "Thêm provider". Bước có khai chế độ thì khối "Cách chạy" vẫn hiện (chế độ áp cho công cụ NIVO nó gọi); bước của engine không khai chế độ thì không có khối nào.
Luật: page-loading-own-shape.md (chữ thật, không khung rỗng), type-scale-14-12.md.
Grammar: `Text size="xs" tone="muted"`.

Shots missing: ảnh cũ chưa vẽ lại sau khi bỏ chế độ theo lệnh.
