# Sơ đồ: ngăn tham số của khối kết thúc (accounting)

<!-- shown -->
Màn này đang hiển thị quy trình "Đối soát tiền về" (`reconcile`, Bản 1, 5 bước): Có việc mới, Khớp tiền với đơn, Đánh dấu đã trả, Ghi sổ, Báo đội tiền về.
<!-- /shown -->

## Ngăn của khối kết thúc: chỉ đọc
Vì sao: khối kết thúc (kết quả hoặc gọi quy trình khác) chỉ được giải thích, không sửa: "Bước này làm gì", "Dữ liệu vào" (mỗi dữ liệu "Lấy từ: <bước> → <thành viên>" hoặc "Giá trị cố định: ..."), "Gọi quy trình" cho bước chuyển (quy trình được gọi với agent + tên + bản, rồi từng dữ liệu truyền đi). Không select đích, không ô giá trị cố định.
Luật: templates.md (một đồ thị là của mẫu), type-scale-14-12.md, surfacecard-select-subtitle.md.
Grammar: `Drawer` + `SurfaceCard kind="list"` dưới `Sublabel`.
Kiểm tra bằng ảnh: không select, không input, không nút Lưu; chưa chụp lại sau khi bỏ phần sửa.
