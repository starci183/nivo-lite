# Sơ đồ: ngăn tham số của khối kích hoạt (accounting)

<!-- shown -->
Màn này đang hiển thị quy trình "Đối soát tiền về" (`reconcile`, Bản 1, 5 bước): Có việc mới, Khớp tiền với đơn, Đánh dấu đã trả, Ghi sổ, Báo đội tiền về.
<!-- /shown -->

## Ngăn của khối kích hoạt: chỉ đọc, giải thích "Chạy khi nào"
Vì sao: sơ đồ của một quy trình đúng bằng sơ đồ của gói mẫu, shop không sửa (templates.md, 2026-11-14), nên ngăn không có ô chọn nguồn hay ô nhập. Mỗi mục là một hàng nhãn / giá trị / dòng phụ 12 muted: "Bước này làm gì", "Chạy khi nào" (mỗi nguồn khởi động quy trình, điều kiện của nó hoặc "Mọi lượt từ nguồn này", dòng phụ "Cung cấp: ..."), "Kết quả trả ra" (từng thành viên với nhãn + loại). Mục không có gì thì không hiện. Không bao giờ hiện khóa.
Luật: templates.md (một đồ thị là của mẫu), type-scale-14-12.md, surfacecard-select-subtitle.md.
Grammar: `Drawer` + `SurfaceCard kind="list"` dưới `Sublabel`; node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts.
Kiểm tra bằng ảnh: không select, không input, không nút Lưu; nhãn 14, giá trị 14, dòng phụ 12; chưa chụp lại sau khi bỏ phần sửa.
