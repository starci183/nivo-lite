---
title: Admin / Workspace (chi tiết)
route: /<workspaceId>
area: admin
---
Route: `/<workspaceId>` (admin app). One customer workspace for the team: header with billing state and support command, an overview figures ribbon and seven list cards.

Grammar paths are under `node_modules/@starci/grammar/dist/core/`. This is the team console (`fe/apps/admin`, its own `WorkspaceShell` with a top bar and no sidebar), not the customer console. The round "N" and "1 Issue" are Next dev overlays, not app UI. Admin is staff-only, so its copy is not in the owner's design canvas; laws are the Grammar and surface laws that apply to every page.

## Header band offset (a 64px pink strip under the top bar)
Vì sao: SAI — a 64px pink strip separates the top bar from the header band (band at y=128, not 64), and the first row of the body is hidden behind the band (the first card labels / the filter tabs are cut). Same sticky-offset defect as the customer console shots: the band sticks 64px too low and content scrolls behind a gap.
Luật: `pink-page-surface-rule.md` (the band is chrome on the white surface and never scrolls away), `nivo-surface-layering.md`.
Grammar: `Page` header band sticky offset (`frame/Page/index.d.ts`, `composite/PageHeader`); shell var in `WorkspaceShell` (`frame/WorkspaceShell/index.d.ts`). Fix in Grammar.

## Page width (measure "full")
Vì sao: SAI — the admin pages use `Page measure="full"`, so content runs edge to edge at 1440 (and further at 1920), 32px from each side. The law caps card content in the pink well at `--grammar-content-max` (80rem) and centres it; only chat, graph and editor panes are full-bleed, and a table card is not one of them. Should be `measure="product"`.
Luật: `page-header-left-sublabel-xs.md` (content inside the pink well: capped at 80rem and centred), `table-heroui-native-section-head.md` (Scroll: 80rem cap only for card panes).
Grammar: `Page measure` (`frame/Page/index.d.ts`, `PageMeasure`). Code: `fe/apps/admin/src/components/blocks/AdminWorkspaces/component.tsx`, `AdminHealth`, `AdminWorkspaceScreen` (all `measure="full"`).

## Header band (trail "Workspace / Tiệm hoa Bình An", name, status chip, description, "Thao tác hỗ trợ")
Vì sao: the trail returns to the list, the name (18) carries the billing state chip ("Đang hoạt động", success dot), a 12 muted line holds owner e-mail, creation date and the code ("Chủ sở hữu chu0@example.test · tạo 11 thg 8, 2026 · mã ws-0"), and the one header command "Thao tác hỗ trợ" is a neutral `md` pill that opens the support-actions drawer (extend billing, mark paid/overdue, change plan, set credits). The description joins three facts with "·" which a meta line allows.
Luật: `page-header-left-sublabel-xs.md`, `type-scale-14-12.md`, `table-heroui-native-section-head.md` ("·" only joins words in meta lines).
Grammar: `Page header={{ breadcrumbs, title, description, status, actions }}` (`frame/Page/index.d.ts`), `Badge isDot`, `Button intent="neutral"`. Code: `fe/apps/admin/src/components/blocks/AdminWorkspaceScreen/component.tsx`.

## Overview figures ribbon (9 figures)
Vì sao: SAI — one `Section kind="figures"` with nine figures in one row at 1440: Trạng thái thanh toán, Gói, Đã trả đến, Credit AI tháng này, Chi phí mô hình tháng này (USD), Thành viên, Tin khách gần nhất, Tin nhắn 7 ngày, Quyết định đang chờ, Nguồn kiến thức. Nine columns are too many: the later labels wrap to two or three lines ("Thành / viên", "Chi phí mô hình tháng này (USD)") so the values sit on different baselines, and "Quyết định đang chờ" (work waiting on the team) gets no pink emphasis. The section title (`overviewTitle`) is not visible. Should be two ribbons (billing; activity) or a 5-figure ribbon with the rest as a list card, and figures wrap 2x2 before a label wraps.
Luật: `surfacecard-zones-api.md` (figures zone: a figure value never breaks inside a number; figures wrap to 2x2 or one column first), `table-heroui-native-section-head.md` (pink for waiting work), `type-scale-14-12.md`.
Grammar: `Section kind="figures" items` (`frame/Section/index.d.ts`) or `SurfaceCard kind="figures"` (`frame/SurfaceCard/index.d.ts`). Code: `fe/apps/admin/src/components/blocks/AdminWorkspaceScreen/component.tsx` (`Body`).

## Card heads (label + plain count at the right)
Vì sao: SAI — each card has its label on the pink and the count ("3", "2", "1") as a plain number at the far right of the label row, coming from `SurfaceCard fact`. The law is label + count CHIP at the left; a right-aligned bare number is far from its label and reads as stray text.
Luật: `table-heroui-native-section-head.md` (section head = label (+ count chip) left, one link or ⓘ right).
Grammar: `Section count` / `SurfaceCard fact` (`frame/Section/index.d.ts`, `frame/SurfaceCard/index.d.ts`). Code: `fe/apps/admin/src/components/composites/AdminRowsCard/index.tsx` (`fact: String(count)`).

## Members card ("Thành viên và vai trò")
Vì sao: SAI — three rows (owner, staff, a pending invite): name 14/500, e-mail/date line 12 muted and a role chip at the end ("owner", "staff", "lời mời đang chờ"). Role words are raw English enum values ("owner", "staff") beside a Vietnamese chip; should be "Chủ sở hữu", "Nhân viên". The invite row's line is cut by the card width ("mời 8 thg 11, 2026 · hết hạn 15 thg 11,…").
Luật: `type-scale-14-12.md`, `blocks-are-real-code.md`.
Grammar: `SurfaceCard kind="list"`, `Badge` (`frame/SurfaceCard`, `leaf/Badge`). Code: `fe/apps/admin/src/components/composites/AdminRowsCard/index.tsx`.

## Assistants card ("Trợ lý")
Vì sao: SAI — rows "chatbot" and "sales" (lower-case keys as titles), a line "ngữ cảnh v4 áp dụng 9 thg 11, 2026 · assist …" cut by width, a "Live"/"setup" status chip and an "openclaw" chip (the runtime name, an internal word) at the end; "đồng bộ ok" as an extra line. The version "v4" is plain text (right, versions never in a chip) but titles and the runtime chip are internal ids; should show the agent names ("Chatbot", "Sales") and drop the runtime chip.
Luật: `surfacecard-select-subtitle.md` (a version like "v1" is plain text, never a chip), `type-scale-14-12.md`.
Grammar: `SurfaceCard kind="list"`. Code: `fe/apps/admin/src/components/composites/AdminRowsCard/index.tsx`.

## Connections card ("Kết nối")
Vì sao: SAI — two rows ("Zalo OA Tiệm hoa" with chips "connected" + "Ok"; "Bot Telegram" with "error" + "Error" and a mono "401 Unauthorized" bar): each row has two chips that say the same thing (status "connected"/"Ok", "error"/"Error") in English with different capitalisation; one chip is enough and it should be Vietnamese ("Đang nối", "Lỗi").
Luật: `type-scale-14-12.md`, `table-heroui-native-section-head.md` (one status chip).
Grammar: `SurfaceCard kind="list"`, `Badge`, `Code`. Code: `fe/apps/admin/src/components/composites/AdminRowsCard/index.tsx` (`badges`, `mono`).

## Errors, SePay payments, knowledge sources, payment orders cards
Vì sao: SAI — the second and third rows of cards repeat the same card anatomy with raw words: "Lỗi gần đây" ("connection" + code line), "Thanh toán SePay" (a "paid" chip, "sự kiện thanh toán · subscription.activated" in a chip), "Nguồn kiến thức" ("document" with "ready 10" and "failed 2" chips), "Đơn thanh toán" (NIVO123 · pro, "paid"). Titles and chips are internal ids ("document", "paid", "failed", "subscription.activated") and "failed 2" is the only owner-visible alarm without emphasis beyond its pink chip. The grid is `Grid kind="cards" columns={3}` for seven cards, so the last row holds one card and the heights are ragged (cards in a row stretch, rows do not).
Luật: `pink-page-surface-rule.md` (separate blocks 12-16px apart; one per job), `type-scale-14-12.md`.
Grammar: `Grid kind="cards" columns={3}` (`frame/Grid/index.d.ts`), `SurfaceCard kind="list"`. Code: `fe/apps/admin/src/components/blocks/AdminWorkspaceScreen/component.tsx` (`Body`).

## Support actions drawer (not shown)
Vì sao: the "Thao tác hỗ trợ" command opens a right drawer: extend billing by N days, mark active / past due, set plan, set credits; each commit goes through an `AlertDialog` confirmation. Not visible in the shots.
Luật: `blocks-are-real-code.md` (data changes via declared actions), `surfacecard-select-subtitle.md` (flat fields).
Grammar: `Drawer`, `AlertDialog`, `Input`, `Select`, `Button` (`frame/Drawer`, `frame/AlertDialog`, `branch/Input`, `branch/Select`). Code: `fe/apps/admin/src/components/blocks/AdminSupportActions/component.tsx`.

## Phone layout (390)
Vì sao: the ribbon becomes a one/two-column grid of figures (each ~76px tall, nine figures take ~480px) and the cards stack in one column with the count "3" under the label; the header keeps the trail, name + chip, description and the support button at the end (the button crowds a 2-line description).
Luật: `surfacecard-zones-api.md` (figures wrap 2x2 or one column), `pink-page-surface-rule.md`.
Grammar: `Section kind="figures"`, `Grid kind="cards"`. Code: `fe/apps/admin/src/components/blocks/AdminWorkspaceScreen/component.tsx`.

## Top bar (title, destinations, language, theme, account)
Vì sao: CHƯA RÕ — the white bar carries the product name "Bảng điều khiển đội NIVO" (bold text), then the destinations "Workspace" and "Sức khỏe nền tảng" as `sm` pills (the open one is `alternative`, the other `neutral`), and at the end the round language dropdown, the sun/moon switch and the account avatar menu with the e-mail and sign out. The language, theme and account controls follow the locale-switch rule. No owner law says destinations of a console are `sm` pill buttons in the bar rather than tabs or a sidebar; the customer console uses a sidebar and header tabs. The first destination also reads like part of the title.
Luật: `locale-switch-round-dropdown.md` (round dropdown, never a pill), `nivo-surface-layering.md` (top bar is white chrome), `page-header-left-sublabel-xs.md` (sm buttons carry no icon).
Grammar: `TopBar brand navigation actions menu` (`composite/TopBar/index.d.ts`), `NavLandmark layout="bar"`, `Button size="sm"`, `DropdownMenu`, `Switch`, `AvatarButton` (`frame/NavLandmark`, `leaf/Button`, `branch/DropdownMenu`, `leaf/Switch`, `leaf/AvatarButton`). Code: `fe/apps/admin/src/components/blocks/AdminHeader/component.tsx`.

## Phone: top bar (390)
Vì sao: SAI — the bar spends the width on the hamburger, the language button, the theme switch and the avatar, leaving the product name cut to "Bảng điều khiển đ…". The destinations move to the left drawer (correct, the hamburger is in the bar, unlike the customer console). The brand should keep its full text (or shrink to a short mark) and the language/theme controls should move into the drawer.
Luật: `type-scale-14-12.md`, `page-header-left-sublabel-xs.md`.
Grammar: `TopBar menu={{ visibility: "compact" }}` with `Drawer placement="left"` (`composite/TopBar/index.d.ts`, `frame/Drawer/index.d.ts`). Code: `fe/apps/admin/src/components/blocks/AdminHeader/component.tsx`.
