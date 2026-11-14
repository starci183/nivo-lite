---
title: Second Brain / Kiến thức / Tài liệu, cuối danh sách
route: /workspaces/<ws>/brain?tab=knowledge&view=documents
area: brain-billing
---
# Second Brain / Kiến thức / Tài liệu, cuối danh sách

Real shot (read only) of the workspace "Tiệm hoa NIVO (brain test)": the figures and rows are what the dev API answers. The same screen scrolled to the end of the list. Shots `1440.png`, `1920.png`, `390.png`.

## Danh sách tài liệu (một dòng mỗi tài liệu)
Vì sao: ONE `SurfaceCard kind="list"` on the pink well, white, shadow, no border. Each row: the title (14, strong), under it ONE 12px muted meta line that says whether the document is found ("Tìm được · N đoạn", or "Tìm theo chữ" while credits are out) and where its truths work stands (sàng lọc a/b, đọc sự thật a/b · n tìm thấy, đưa vào hiệu lực, N đoạn quy định, dữ liệu không thành sự thật, đang đọc các phần còn lại của tệp, chờ credit, đã chạm trần, chưa đọc được). Old documents that still say `extracting_facts` stay readable ("đang đọc sự thật"). A row with no `truths` (not indexed yet) shows nothing new.
Luật: `type-scale-14-12`, `table-heroui-native-section-head` (one content per card, no section description), `row-control-clearance` (Grammar pads the row).
Grammar: `SurfaceCard kind="list"` `items` `ListRowData.description` (a node is drawn at 12 muted), `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Chip kết quả ở cuối dòng
Vì sao: at most TWO chips per row (Grammar's `badges` is a pair); a result is a Badge WITHOUT a dot ("118 hiệu lực" success, "9 cần hỏi" warning, "Chỉ để tìm", "Chờ phản biện", "Hết credit" warning, "Đã chạm trần" warning, "Lỗi đọc" and "Lỗi" danger); only something that is running has a dot ("Đang sàng lọc", "Đang đọc", "Đang nạp"). A third fact ("4 chờ chủ tiệm duyệt" beside in force and asked) is said in the meta line, which is why the drawing's third chip is not a chip.
Luật: `badge-dot-or-not`, `red-budget-links-foreground` (danger is a state, never a CTA).
Grammar: `ListRowData.badges` (`BadgeData` `isDot`), `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`; `Badge`, `node_modules/@starci/grammar/dist/core/leaf/Badge/index.d.ts`.

## Nút cuối dòng (Xem, và Trả lời / Thử lại / Nạp credit)
Vì sao: "Xem" is the row's `action` (neutral outlined pill, opens the document page); one more neutral `Button size="sm"` sits beside it when the row has a next step: "Trả lời" (the document's questions page) when something needs the founder, "Thử lại" (the existing retry door: a failed document runs again, a document whose truths were not read is read again) and "Nạp credit" (the billing page). No icons on sm buttons, no red: the page has no main CTA.
Luật: `suggestion-button-sm`, `page-header-left-sublabel-xs` (sm buttons never carry an icon), `red-budget-links-foreground`.
Grammar: `ListRowData.action` and `ListRowData.control` with `Button size="sm"`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Bấm vào dòng (ngăn kéo, không có trong shot)
Vì sao: pressing the row itself opens the existing drawer (the way the document took and the facts it gave, with the approval of the safe ones together); not captured here.
Luật: `complex-content-page-not-drawer` (only a short detail stays a drawer; the full document is the page behind "Xem").
Grammar: `Drawer`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`.

## Trạng thái đọc cũ và ghi chú sau khi đọc xong
Vì sao: a document whose `truths.state` is `legacy` has its own line ("đọc theo cách cũ — chưa đếm đoạn": passage counts 0 mean not counted, not none found), the chip "Đọc cách cũ" and the existing "Đọc lại" door (`retry-facts`, the same command as "Thử lại" of a failed reading). The notes of a finished reading are said in the meta line: lượt đọc lỗi sẽ đọc lại (with "Đọc lại"), dòng không khớp tài liệu, sự thật chờ chủ tiệm duyệt.
Luật: `badge-dot-or-not`, `suggestion-button-sm`.
Grammar: `ListRowData.description`, `ListRowData.control` with `Button size="sm"`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.
