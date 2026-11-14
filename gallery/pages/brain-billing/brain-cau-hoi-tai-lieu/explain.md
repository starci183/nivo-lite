---
title: Second Brain / Tài liệu / Câu hỏi của một tài liệu
route: /workspaces/<ws>/knowledge/<id>/questions
area: brain-billing
---
# Câu hỏi của một tài liệu (dữ liệu thật)

Shots `1440.png`, `1920.png`, `390.png`: workspace "NIVO", tài liệu "Quy định Tiệm hoa NIVO (bản thử)" (8 điểm đang chờ, đọc từ `brainCritique` thật; khung bấm bị chặn nên không ghi gì). Route `features/pages/KnowledgeQuestionsPage` (server: tiêu đề + đường dẫn) vẽ `Page` một lần (R325) và ghép hai khối nối dữ liệu `DocumentRelease` và `DocumentQuestions` (khối không import khối). Đây là trang MỚI chủ shop yêu cầu (bản vẽ B + F của `truth-graph-flows`); một lối vào cho mỗi tài liệu, không có thẻ /chat (INGEST-SEAM mục 5). Grammar nằm dưới `node_modules/@starci/grammar/dist/core/`.

## Khung console (thanh trên, thanh bên)
Vì sao: khung dùng chung, đã giải thích một lần ở `shell/khung-chung`; mục "Second Brain" hiện chip hồng 101 vì đó là việc chờ chủ shop.
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `Sidebar`, `composite/TopBar/index.d.ts`, `composite/Sidebar/index.d.ts`.

## Dải đầu trang (đường dẫn Tổng quan / Second Brain / Tài liệu / Câu hỏi, tiêu đề, một dòng)
Vì sao: đường dẫn dài hơn Second Brain một bậc vì đây là trang con của một tài liệu; tiêu đề và dòng mô tả 14 muted nằm sát lề trái; không có tab và không có nút vì trang chỉ có một việc (trả lời). Tên tài liệu nằm ở dòng đầu thẻ bên dưới, không nhét vào đường dẫn (đường dẫn của server không biết tên tài liệu).
Luật: `page-header-left-sublabel-xs.md`, `complex-content-page-not-drawer.md` (nội dung nhiều phần là một TRANG), `type-scale-14-12.md`.
Grammar: `Page` `header` (`PageHeaderContent`), `frame/Page/index.d.ts`, `frame/PageHeader/index.d.ts`; story `Frame/Page`.

## Thẻ "Phát hành cho khách" (tên tài liệu, "N đoạn khách đọc được", hai dòng tên/giá trị, nút Xem N điểm)
Vì sao: vùng F của bản vẽ. Tên tài liệu là nhãn của thẻ, số đoạn khách đọc được là `fact` cạnh nhãn (một sự kiện ngắn do Grammar vẽ; bản vẽ vẽ chip xanh nhưng màu chip kết quả không thuộc `SurfaceCard`, không đổi màu thiết kế để khớp bản vẽ). Bên trong là danh sách tên/giá trị (`layout="keyValue"`): "Đang giữ · N đoạn đang chờ bạn trả lời" và "Chờ soát · N đoạn chờ NIVO soát", chỉ hiện dòng có số > 0; không còn gì giữ thì một dòng "Mọi đoạn đã phục vụ khách". Đây là MỘT nội dung của thẻ (danh sách), nút nằm ở vùng chân thẻ. "Xem N điểm" là nút trung tính cỡ sm, trỏ tới khối câu hỏi bên dưới. "Phát hành" (nút đỏ duy nhất của trang) chỉ hiện khi còn đoạn chờ soát và người xem là chủ shop: xem thư mục `…-xac-nhan-phat-hanh`.
Luật: `pink-page-surface-rule.md` (thẻ trắng nổi trên nền hồng, bóng, không viền), `red-budget-links-foreground.md` (một nút đỏ), `suggestion-button-sm.md`, `table-heroui-native-section-head.md`, `row-control-clearance.md`.
Grammar: `SurfaceCard kind="list" layout="keyValue"` + `footers=[{ kind: "custom" }]` + `Button size="sm"`, `frame/SurfaceCard/index.d.ts`; story `Frame/SurfaceCard`.

## Dòng đầu danh sách ("<tài liệu> · N điểm cần chủ tiệm trả lời")
Vì sao: một dòng 12 muted trên nền hồng, ngay trên thẻ đầu tiên: chỉ nhãn khối được nằm trên nền hồng, dòng này là nhãn của cả khối câu hỏi. Số N là số điểm chủ shop thấy (quản lý không thấy điểm nhắm vào AI).
Luật: `pink-page-surface-rule.md`, `type-scale-14-12.md`, `surfacecard-select-subtitle.md` (không có dòng giải thích lẻ; đây là nhãn khối).
Grammar: `Text size="xs" tone="muted"`, `leaf/Text/index.d.ts`.

## Thẻ một nhóm điểm (nhãn nhóm + chip đếm hồng, các điểm là các dòng)
Vì sao: một thẻ cho MỖI NHÓM nghi vấn (Mâu thuẫn trong file, Khác dữ liệu shop, nhóm `unclear`, ...), các điểm cùng nhóm là các dòng cùng loại trong MỘT danh sách (mỗi thẻ một nội dung; cùng loại thì một list); thứ tự nhóm theo điểm đầu tiên backend đã sắp (cao trước, cũ trước). Chip đếm hồng vì đó là việc chờ chủ shop.
Luật: `table-heroui-native-section-head.md` (nhãn + chip đếm bên trái), `complex-content-page-not-drawer.md`, SURFACE-ELEVATION (`ui/components/card.md`: thẻ trên nền hồng có bóng, không viền).
Grammar: `SurfaceCard kind="list"` với `label`, `count`, `isAttention`, `ListRowData.detail`, `frame/SurfaceCard/index.d.ts`, `surfaceCardData.d.ts`.

## Một điểm (tiêu đề, chip loại, câu trích nguyên văn, câu hỏi, lý do, các nút)
Vì sao: tiêu đề là dòng backend lưu; chip KHÔNG chấm chỉ hiện khi nhóm có nhiều loại (ví dụ "Thiếu giá trị", nhãn của kind `unclear`): nhãn kết quả/loại, không phải trạng thái đang chạy. Câu bị nghi được trích nguyên văn trong `Quote` (nền xám, không phải bề mặt, không lồng thẻ trong thẻ), kèm "Đoạn N" khi tài liệu ghi vị trí. Dưới đó là câu hỏi 14, lý do 12 muted, rồi các lựa chọn là nút trung tính sm (nhãn do backend soạn, hiện nguyên) và "Bỏ qua" cuối cùng. Không có nút đỏ: bấm lựa chọn không áp dụng sự thật, chỉ chuyển giá trị vào hàng đề nghị.
Luật: `suggestion-button-sm.md` (nút trả lời = Button sm trung tính), `badge-dot-or-not.md`, `type-scale-14-12.md`, `row-control-clearance.md`, `red-budget-links-foreground.md`.
Grammar: `Quote text byline`, `composite/Quote/index.d.ts`; `Button intent="neutral" size="sm"`, `leaf/Button/index.d.ts`; `Badge` (không `isDot`), `leaf/Badge/index.d.ts`; composite của app `CritiquePointDetail`.
