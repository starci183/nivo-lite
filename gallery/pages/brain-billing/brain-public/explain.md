---
title: Second Brain / Công khai
route: /workspaces/<ws>/brain (tab Công khai)
area: brain-billing
---
# Second Brain, Công khai

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `PublicBrain` (components/blocks/PublicBrain/component.tsx) with frames `PublicAsksCard`, `PublicDocsTable`, `PublicDocDrawer`. Shots `1440.png`, `390.png`, `390-bottom.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang và tầng tab 1 (Công khai đang chọn)
Vì sao: SAI — same chrome; band title "Second Brain" with the sublabel "Chatbot chỉ trả lời khách từ phần này. Soạn riêng, bạn duyệt rồi mới xuất bản." and the command "Soạn tài liệu công khai" (neutral sm pill) and ⋯; no second tab layer here (correct, only Kiến thức has one). Defect: the blank 64px pink strip above the band. The same command is repeated in the empty table below (SAI: two places).
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`, `suggestion-button-sm.md`.
Grammar: `PageHeader`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`; composite `BrainHeaderActions`.

## Thẻ "Không có câu khách hỏi nào đang chờ" và dòng chú thích
Vì sao: SAI — a floating card holding only an empty notice (icon, message, sentence) and no head saying what the card is ("Câu hỏi chưa có đáp"); a lone sentence is never a card; the 12px line under it ("Chatbot chuyển người khi không có câu trả lời công khai.") explains a rule, not data, and belongs to the empty state or a head subtitle.
Luật: `table-heroui-native-section-head.md` (a lone sentence is never a card; section head with label), `surfacecard-select-subtitle.md`.
Grammar: `Section title`, `EmptyNotice frame="frameless"`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`; frame `PublicAsksCard`.

## Đầu khối "Tài liệu công khai" + "Chưa có văn bản"
Vì sao: SAI — the label is correct (14/500 on the pink) but the right side holds a plain muted sentence "Chưa có văn bản" (an empty counter in words) instead of a count chip next to the label or one → link.
Luật: `table-heroui-native-section-head.md` (label + count chip left, one → link or ⓘ right).
Grammar: `PaneHeader title count`, `Badge`, `node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts`.

## Bảng tài liệu công khai (tab Tất cả / Đã xuất bản / Chờ duyệt / Cần xem lại / Đang soạn / Không soạn được, ô tìm, cột Văn bản, Loại, Trạng thái, Duyệt bởi / lúc)
Vì sao: SAI/OK split. OK: it is a grey-framed table with the filter tabs and the search in its header zones, then the column labels in the grey (the native frame per the table law). SAI: six filter tabs with no count chips (the law says filter tabs show grey 0), the empty state sits INSIDE the white body together with its own primary button while the head already has "Soạn tài liệu công khai" (three entry points for one command), and columns "Loại" and "Duyệt bởi / lúc" are wider than their content.
Luật: `table-heroui-native-section-head.md` (native table; filter tabs show grey 0), `surfacecard-zones-api.md` (filter + search zones; on mobile search becomes an icon).
Grammar: `SurfaceCard kind="table" headers=[filter, search] columns`, `DataTable`, `node_modules/@starci/grammar/dist/core/branch/DataTable/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`; frame `PublicDocsTable`.

## Trạng thái trống "Chưa có tài liệu công khai" + nút "Soạn tài liệu công khai"
Vì sao: SAI — the empty state is correct inside a table (icon tile, bold message, sentence, primary commit) but it duplicates the band command; keep one.
Luật: `suggestion-button-sm.md`, ui-laws "EmptyNotice on a pane is frameless".
Grammar: `EmptyNotice`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: nav row, blank strip, band; table tabs scroll, search becomes an icon per the zones rule (not verified in the shot).
Luật: `surfacecard-zones-api.md`.
Grammar: `SurfaceCard headers`.
