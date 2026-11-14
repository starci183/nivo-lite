---
title: Second Brain / Sự thật (Danh sách)
route: /workspaces/<ws>/brain?tab=knowledge&view=facts
area: brain-billing
---
# Second Brain / Sự thật (Danh sách)

Real shot (read only) of the workspace "Tiệm hoa NIVO (brain test)", the Danh sách mode of Sự thật. Block `BrainFacts` (`components/blocks/BrainFacts`), table `FactPickTable`. Shots `1440.png`, `1920.png`, `390.png`.

## Khung console và hai tầng tab
Vì sao: the same white chrome and the two tab layers as the other Brain pages ("Sự thật" lit under Kiến thức). Unchanged by this wave.
Luật: `nivo-surface-layering`, `page-header-left-sublabel-xs`.
Grammar: `PageHeader` `tabs` `subTabs`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Thẻ Bộ não của tiệm: chuyển Danh sách / Bản đồ
Vì sao: the card's first header zone is the primary pill (two views of the same facts), at the trailing edge; the map mode is left as it was.
Luật: `surfacecard-zones-api` (pill = primary tabs, 2 to 4 modes), `surface-card-kind`.
Grammar: `SurfaceCard` `headers` `kind: "switch"`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Lọc theo trạng thái (Tất cả, Chờ duyệt, Đang dùng, Giá trị khác nhau, Ngừng dùng)
Vì sao: underline filter tabs with their counts, one header zone. The counts are the rows of the whole read of the brain; the first three and the last one narrow the SERVER read (`brain(facts: { statuses })`: Chờ duyệt = proposed, Đang dùng = active and scheduled, Ngừng dùng = expired), "Giá trị khác nhau" is read from the whole brain because a conflict needs both a value in force and a proposal.
Luật: `surfacecard-zones-api` (underline = secondary tabs: views and filters).
Grammar: `SurfaceCard` `headers` `kind: "filter"`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Ô tìm sự thật
Vì sao: the search zone under the filter; typing waits 300 ms, then the server searches subject, attribute and value (`brain(facts: { search })`, accents ignored) and the list goes back to page 1. The conflict tab searches the whole read in the browser.
Luật: `surfacecard-zones-api`.
Grammar: `SurfaceCard` `headers` `kind: "search"`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Dòng gợi ý chọn và nút Theo chủ đề / Theo tài liệu
Vì sao: the hint says what ticking does; the pill beside it groups the rows by subject or by document. Unchanged by this wave.
Luật: `surfacecard-zones-api`.
Grammar: `SurfaceCard` `headers` `kind: "switch"`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Bảng sự thật (nhóm, dòng, giá trị, độ tin cậy, nút mở)
Vì sao: Grammar's native table in the grey frame: a group row with its count and "Thu gọn", then one row per subject and attribute with the value, the trust chip (a result, no dot) and the open arrow; ticks only where the owner may approve together. The rows are the page the server answered (50 facts), grouped here; a key is read as the whole brain knows it, so a value in force beside a proposal is still a conflict.
Luật: `table-heroui-native-section-head`, `badge-dot-or-not`, `row-control-clearance`.
Grammar: `SurfaceCard kind="table"` `columns` `groups`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/TableRows.d.ts`.

## Chân bảng: phân trang ("1-50 / 169", Trước, 1, 2, Sau)
Vì sao: the footer zone of the same card. The server pages by cursor (`factsNextCursor`); "Sau" asks the next cursor, "Trước" and a page number already seen go back from the stack of cursors, so the pager only offers the pages the reader has reached plus the next one. The summary counts facts (`factsTotal`), the page rows are keys. It exists only when the total is above one page (50).
Luật: `surfacecard-zones-api` (footers: more, paging).
Grammar: `SurfaceCard` `footers` `kind: "paging"`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.
