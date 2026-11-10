---
title: Credit và gói
route: /workspaces/<ws>/billing
area: brain-billing
---
# Credit và gói (billing)

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Blocks `BillingOverview` + `CreditsOverview` (components/blocks) with composites `UsageCard`, `CreditsBalance`, `CreditsCatalogue`, `BillingHistoryList`, `BillingRenewal`; route `(console)/billing`. Shots `1440.png`, `390.png`, plus `1440-bottom.png` and `390-bottom.png` for the lower half. Grammar paths under `node_modules/@starci/grammar/dist/core/`. The Next dev "N" and the red assistant dot are overlays, not content.

## Thanh trên cùng (workspace, ngôn ngữ, công tắc giao diện, avatar)
Vì sao: white console top bar: workspace identity on the left, round language dropdown, a sun/moon theme toggle and the Sprout avatar. The theme toggle is not covered by any owner law and dark mode must resolve only from theme tokens; CHƯA RÕ whether a visible toggle is wanted.
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`, `owner-colors-exact.md` (dark from tokens only).
Grammar: `TopBar`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`; `ThemeSwitch` composite.

## Thanh bên (Tổng quan ... Credit & gói đang chọn)
Vì sao: white sidebar with a right border; groups with 12 muted labels; the current item is a pink soft pill with primary text; the pink chip on Second Brain (73) means work waiting on the owner. Same sidebar as every console page.
Luật: `nivo-surface-layering.md`, `table-heroui-native-section-head.md` (pink chip = waiting on owner), `type-scale-14-12.md`.
Grammar: `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`; composite `ConsoleSidebar`.

## Dải đầu trang (đường dẫn, tiêu đề "Credit & gói", mô tả)
Vì sao: SAI — the white header band is preceded by an empty 64px pink strip at 1440 (and on 390 the mobile nav row plus another blank strip), so the band does not sit directly under the top bar; when the page scrolls the content shows in that strip above the sticky band (see `1440-bottom.png`) and the first card is clipped under the band. The band must start under the top bar and be the only sticky layer. Its text itself is flush left with breadcrumb + title + 14 muted sublabel, which is right.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md` (header band never scrolls away), `page-header-left-sublabel-xs.md`.
Grammar: `Page header`, `PageHeader`, `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`; `Breadcrumbs`.

## Thẻ gói hiện tại (Gói hiện tại, Trạng thái, Đã thanh toán đến)
Vì sao: SAI — (partly right, see the flagged part) one card = one fact list (DescriptionList in columns, divided), correct as a details card. The data contradicts itself: "Chưa có gói" together with status "Đang hoạt động" and "Chưa thanh toán" (SAI of the content: a workspace with no plan cannot be active). The card has no label above it while its siblings do.
Luật: `table-heroui-native-section-head.md` (Sublabel above each card; one content per card).
Grammar: `SurfaceCard`, `DescriptionList layout="columns" isDivided`, `Badge isDot`, `node_modules/@starci/grammar/dist/core/composite/DescriptionList/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Khối "Mức dùng AI" (thanh Credit AI trong tháng) và dòng chú thích
Vì sao: SAI — a Sublabel over a card holding a Meter with "39 (không giới hạn)" (an empty bar for an unlimited plan), correct as a figure; but the 12px sentence beneath ("Mỗi việc AI làm sẽ trừ credit...") is a loose explanation, not a legend, and should be the row subtitle.
Luật: `surfacecard-select-subtitle.md` (subtitle rule), `table-heroui-native-section-head.md`.
Grammar: `Meter`, `SurfaceCard`, `node_modules/@starci/grammar/dist/core/leaf/Meter/index.d.ts`; composite `UsageCard`.

## Thẻ "Credit còn lại / Tháng"
Vì sao: SAI — a second details card (Credit còn lại: Không giới hạn; Tháng: tháng 11 năm 2026) right under the usage meter for the same job (this month's usage); the law says same-kind content stays in one list and one card per job; also "Credit tháng này" repeats lower down (see bottom). Merge into one card.
Luật: `table-heroui-native-section-head.md` (ONE CONTENT PER CARD; same-kind items stay in one list), `pink-page-surface-rule.md` (one block per job).
Grammar: `SurfaceCard kind="details"`, `DescriptionList`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`; composite `CreditsBalance`.

## Khối "Theo agent" (Tìm tri thức, Nhận diện ý định)
Vì sao: a Sublabel and a list card, each row a noun title with a 12 muted line "28 lượt · 11 credit" (the middle dot joins words in a meta line, allowed). Correct list pattern.
Luật: `surfacecard-select-subtitle.md` (row title + subtitle), `table-heroui-native-section-head.md`, `type-scale-14-12.md`.
Grammar: `SurfaceCard` + `ListRow`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`.

## Khối "Credit theo ngày" (biểu đồ cột, nhãn 01 – 09)
Vì sao: SAI — a bar chart in a card whose only data are two bars; each bar is a 60px wide solid red block that dominates the card (minimum bar size with too few points), the x axis shows only "01 – 09" instead of dates under bars, no value labels. A two-point series should be a figure, not a chart; the chart must follow the data-viz rules with thin bars.
Luật: `grammar-core-heroui.md`, `type-scale-14-12.md`, dataviz rules.
Grammar: `BarChart`, `node_modules/@starci/grammar/dist/core/composite/BarChart/index.d.ts`; composite `UsageCard minimumBarSize`.

## Thẻ trống "Không có giao dịch nào cần đối soát."
Vì sao: SAI — an empty card with an icon tile and one sentence and NO label saying which region it is (it is the "Cần đối soát" review list, `BillingHistoryList` with `reviewTitle`); the empty state must sit under its Section title, otherwise the owner sees an unexplained white box. Also a lone sentence in a card.
Luật: `table-heroui-native-section-head.md` (section head: label + count left; a lone sentence is never a card), ui-laws "EmptyNotice on a pane is frameless".
Grammar: `Section title`, `EmptyNotice`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`; composite `BillingHistoryList`.

## Khối "Credit tháng này" (Đã dùng 39 credit; nạp thêm, dự báo hết, cộng dồn)
Vì sao: SAI — the same quantity (39 credit used this month) is shown three times on one page (usage meter, remaining card, this card), the card repeats its own label as an inner Sublabel ("Credit tháng này" under the block label "Credit tháng này"), and it mixes a figure with a fact list; it is `CreditsBalance` rendered next to `UsageCard`. Merge with the usage cards.
Luật: `table-heroui-native-section-head.md` (ONE CONTENT PER CARD), `surfacecard-select-subtitle.md`.
Grammar: `SurfaceCard`, `DescriptionList`, `Meter`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Thẻ trống "Chưa có thanh toán nào."
Vì sao: SAI — same defect as the review empty state: an unlabelled card with a lone sentence; the history section head ("Lịch sử thanh toán") is missing.
Luật: `table-heroui-native-section-head.md`.
Grammar: `Section`, `EmptyNotice`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Cột phải: thẻ Enterprise ("Liên hệ NIVO")
Vì sao: SAI — a card with a title, a description cut off by an ellipsis and a neutral md button, sitting at the top of the right column with no label; a lone sentence in a card. It should be a row of the plans list or a plain link ("Liên hệ NIVO") under "So sánh các gói".
Luật: `table-heroui-native-section-head.md` (ONE CONTENT PER CARD; lone sentence), `suggestion-button-sm.md`.
Grammar: `SurfaceCard`, `Button`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`; composite `CreditsUpgrade`.

## Cột phải: "Nạp thêm credit" (1.000, 3.000, 10.000 credit) với nút "Mua"
Vì sao: a block label on the pink over one list card; each row = pack name (14/500) + price (12 muted) and a neutral sm "Mua" pill at the right edge without icon; correct per the list and button laws. The caption below ("Dùng khi hết credit tháng · hạn 12 tháng") is a note about the pack data, allowed as a legend.
Luật: `surfacecard-select-subtitle.md`, `page-header-left-sublabel-xs.md` (sm buttons no icon), `suggestion-button-sm.md`.
Grammar: `SurfaceCard` + `ListRow`, `Button intent="neutral" size="sm"`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`; composite `CreditsCatalogue`.

## Liên kết "So sánh các gói →"
Vì sao: SAI — a navigation link floating loose at the bottom of the right column; navigation links belong in a section head as "… →" (hover underline, arrow slides). It carries the main way to change plan yet is smaller than the "Mua" buttons.
Luật: `table-heroui-native-section-head.md` (section head right side = one → link), `page-header-left-sublabel-xs.md`.
Grammar: `Link` with arrow in `PaneHeader actions`, `node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: SAI — (partly right, see the flagged part) the sidebar collapses behind a round "⋯" button in its own row, then a blank pink strip, then the band; cards stack in one column, the right column blocks (Enterprise, Nạp thêm) follow after the left ones. The extra blank strip and the separate nav row cost 128px of the first screen (SAI, same band defect).
Luật: `nivo-surface-layering.md` (below lg the aside becomes the first blocks), `pink-page-surface-rule.md`.
Grammar: `Sidebar` responsive, `PaneGrid`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`.
