---
title: Second Brain / Tài liệu / Câu hỏi (mẫu: mỗi loại điểm một cái)
route: /workspaces/<ws>/knowledge/<id>/questions
area: brain-billing
---
# Câu hỏi của một tài liệu (DỮ LIỆU GIẢ LẬP)

Shots `1440.png`, `1920.png`, `390.png` (cao hơn màn hình để thấy đủ trang). `BrainCritique` được trả lời trong trình duyệt bằng dữ liệu mẫu (dev chưa có đủ loại): một điểm mâu thuẫn với sự thật đang hiệu lực, một điểm "nghe nói", một điểm "chưa ghi ngày", một điểm nhắm vào AI, cùng `serving` có cả đoạn đang giữ lẫn đoạn chờ soát. Không gửi gì lên API. Cấu trúc trang xem `brain-cau-hoi-tai-lieu/explain.md`; ở đây chỉ nêu phần khác.

## Dải đầu trang
Vì sao: như trang dữ liệu thật: đường dẫn bốn bậc, tiêu đề và dòng mô tả sát lề trái, không nút, không tab.
Luật: `page-header-left-sublabel-xs.md`, `complex-content-page-not-drawer.md`.
Grammar: `Page header`, `frame/Page/index.d.ts`; story `Frame/Page`.

## Thẻ "Phát hành cho khách" có đoạn đang giữ và đoạn chờ soát
Vì sao: hai dòng tên/giá trị (Đang giữ 2 đoạn đang chờ bạn trả lời, Chờ soát 1 đoạn chờ NIVO soát), "9 đoạn khách đọc được" cạnh nhãn. "Phát hành" là nút đỏ DUY NHẤT của trang, chỉ vì còn đoạn chờ soát và người xem là chủ shop; nó chỉ phục vụ đoạn chờ soát chứ không phải các đoạn còn điểm (lời xác nhận nói rõ). "Xem 4 điểm" nút trung tính sm.
Luật: `red-budget-links-foreground.md`, `suggestion-button-sm.md`, `pink-page-surface-rule.md`.
Grammar: `SurfaceCard kind="list" layout="keyValue"` + `footers`, `AlertDialog` (xem `…-xac-nhan-phat-hanh`), `frame/SurfaceCard/index.d.ts`.

## Dòng đầu danh sách
Vì sao: một dòng 12 muted "<tài liệu> · 4 điểm cần chủ tiệm trả lời" trên nền hồng, nhãn của cả khối câu hỏi.
Luật: `pink-page-surface-rule.md`, `type-scale-14-12.md`.
Grammar: `Text size="xs" tone="muted"`, `leaf/Text/index.d.ts`.

## Nhóm "Khác dữ liệu shop": điểm mâu thuẫn với sự thật đang hiệu lực
Vì sao: dòng bold là tiêu đề backend; bên trong là danh sách có viền (bề mặt trong bề mặt, không nền xám) gồm hai dòng: giá trị đang hiệu lực kèm nguồn ("Chủ tiệm chỉnh · 11/11 · bản 7") và giá trị tài liệu ghi kèm vị trí ("Đoạn 12"); dưới là câu hỏi, lý do 12 muted, và ba lựa chọn của backend (Giữ 30.000 đ, Dùng 25.000 đ, Giữ cả hai) cộng "Bỏ qua", toàn nút trung tính sm, không đỏ. Chọn xong điểm biến khỏi danh sách, giá trị đi vào hàng đề nghị (không tự áp dụng sự thật).
Luật: `stop-card-design.md` (danh sách trong thẻ có viền, không hộp xám), `suggestion-button-sm.md`, `type-scale-14-12.md`, SURFACE-ELEVATION (`ui/components/card.md`).
Grammar: `Section kind="list"` không đầu (`ariaLabel`) trong `ListRowData.detail`, `frame/Section/index.d.ts`; `Button size="sm"`.

## Nhóm "Thiếu / chưa rõ": điểm "Nghe nói, chưa chắc" và "Chưa ghi ngày"
Vì sao: hai điểm cùng nhóm là hai dòng của MỘT danh sách; chip không chấm ở cuối dòng tiêu đề nói loại cụ thể (nhãn loại, không phải trạng thái đang chạy). Câu nghi ngờ nằm nguyên văn trong `Quote` kèm vị trí và ngày dự kiến ("Đoạn 20 · dự kiến: 20:30"); các nút là "Điền cho rõ" / "Vẫn áp dụng, sửa ngày" (mở một ô nhập nhỏ ngay dưới điểm, gửi giá trị đã gõ), "Bỏ dòng này", "Bỏ qua".
Luật: `badge-dot-or-not.md`, `suggestion-button-sm.md`.
Grammar: `Quote`, `Badge` (không `isDot`), `Input` + `Button size="sm"` trong `CritiquePointDetail`.

## Nhóm "Không phải lời của shop": đoạn nhắm vào AI
Vì sao: chỉ chủ shop thấy nhóm này. Dòng nhắm vào AI chỉ hiện như TRÍCH DẪN (nền xám, vị trí "Đoạn 31"), tiêu đề cố định của nhóm, tuyệt đối không là chỉ thị hay tiêu đề; câu hỏi "Đoạn này có phải do shop viết không? …" và chỉ có "Bỏ qua" vì backend chưa có cửa "Bỏ dòng này" / "Bỏ cả đoạn" (đã ghi yêu cầu backend mục 3 của "FE-LEAD → backend").
Luật: `drawings-obey-grammar-laws.md` (bản vẽ có hai nút nữa; chưa có backend thì không dựng), `red-budget-links-foreground.md`.
Grammar: `Quote`, `Button size="sm"`.
