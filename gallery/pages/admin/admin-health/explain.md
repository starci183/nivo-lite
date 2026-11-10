---
title: Admin / Sức khỏe nền tảng
route: /health
area: admin
---
Route: `/health` (admin app). Platform health: sign-ups per day, SePay payments, admin activity, application errors, as four list cards. The shot is scrolled (the first row of the top cards is under the band).

Grammar paths are under `node_modules/@starci/grammar/dist/core/`. This is the team console (`fe/apps/admin`, its own `WorkspaceShell` with a top bar and no sidebar), not the customer console. The round "N" and "1 Issue" are Next dev overlays, not app UI. Admin is staff-only, so its copy is not in the owner's design canvas; laws are the Grammar and surface laws that apply to every page.

## Header band offset (a 64px pink strip under the top bar)
Vì sao: SAI — a 64px pink strip separates the top bar from the header band (band at y=128, not 64), and the first row of the body is hidden behind the band (the first card labels / the filter tabs are cut). Same sticky-offset defect as the customer console shots: the band sticks 64px too low and content scrolls behind a gap.
Luật: `pink-page-surface-rule.md` (the band is chrome on the white surface and never scrolls away), `nivo-surface-layering.md`.
Grammar: `Page` header band sticky offset (`frame/Page/index.d.ts`, `composite/PageHeader`); shell var in `WorkspaceShell` (`frame/WorkspaceShell/index.d.ts`). Fix in Grammar.

## Page width (measure "full")
Vì sao: SAI — the admin pages use `Page measure="full"`, so content runs edge to edge at 1440 (and further at 1920), 32px from each side. The law caps card content in the pink well at `--grammar-content-max` (80rem) and centres it; only chat, graph and editor panes are full-bleed, and a table card is not one of them. Should be `measure="product"`.
Luật: `page-header-left-sublabel-xs.md` (content inside the pink well: capped at 80rem and centred), `table-heroui-native-section-head.md` (Scroll: 80rem cap only for card panes).
Grammar: `Page measure` (`frame/Page/index.d.ts`, `PageMeasure`). Code: `fe/apps/admin/src/components/blocks/AdminWorkspaces/component.tsx`, `AdminHealth`, `AdminWorkspaceScreen` (all `measure="full"`).

## Header band (title "Sức khỏe nền tảng", description)
Vì sao: the band has the title (18) and one 14 muted sentence ("Đăng ký mới, thanh toán SePay, lỗi ứng dụng và hoạt động quản trị gần đây."), flush left, no trail ("root"), no actions. It is correct for a root console page.
Luật: `page-header-left-sublabel-xs.md` (band flush left), `type-scale-14-12.md`.
Grammar: `Page header={{ breadcrumbs: "root", title, description }}` (`frame/Page/index.d.ts`). Code: `fe/apps/admin/src/components/blocks/AdminHealth/component.tsx`.

## Cards grid (2 by 2 list cards)
Vì sao: four `SurfaceCard kind="list"` in `Grid kind="sections"`: a card per question (sign-ups, payments, admin actions, errors), each with its label on the pink, hairline-separated rows and an empty notice inside. Cards in a row share the row height, so the SePay card stretches over empty white space (~100px) next to the dated list; the grid is two columns at 1440 and one column on the phone.
Luật: `pink-page-surface-rule.md` (separate floating white blocks, one per job, 12-16px apart), `nivo-surface-layering.md`.
Grammar: `Grid kind="sections"` (`frame/Grid/index.d.ts`), `SurfaceCard kind="list" label headingLevel` (`frame/SurfaceCard/index.d.ts`). Code: `fe/apps/admin/src/components/composites/AdminRowsCard/index.tsx`.

## Sign-ups per day card (dates with count chips)
Vì sao: SAI — each row is a date ("2026-11-09") with the day's sign-up count as a pink chip. A sign-up count is a plain quantity: grey; pink is reserved for work waiting on someone. Dates are ISO strings in a Vietnamese UI (the other rows use "9 thg 11, 2026"); should be the same short date as the other cards and a grey chip.
Luật: `table-heroui-native-section-head.md` (grey = plain quantity, pink only for work waiting on the owner), `type-scale-14-12.md`.
Grammar: `SurfaceCard kind="list" items: ListRowData { title, badges }` (`frame/SurfaceCard/index.d.ts`), `Badge tone` (`leaf/Badge`). Code: `fe/apps/admin/src/components/composites/AdminRowsCard/index.tsx`, view in `AdminHealth`.

## SePay payments card ("25 chuyển khoản gần nhất", paid 14, unmatched 1, rows)
Vì sao: SAI — the card's first row is its own title ("25 chuyển khoản gần nhất") with two chips on the right ("paid 14" success, "unmatched 1" pink) instead of a label above the card and count chips beside it; the rows then mix two kinds in one list: transfers ("500.000 ₫", "05:21 9 thg 11, 2026 · chuyen khoan", chip "unmatched") and events ("sự kiện thanh toán: subscription.activated" with the workspace button). The status words "paid", "unmatched", "subscription.activated" and the bank word "chuyen khoan" (no diacritics) are raw codes, not Vietnamese labels; should be "Đã khớp / Chưa khớp", "Gói đã kích hoạt", "chuyển khoản".
Luật: `table-heroui-native-section-head.md` (head = label + count chip; same-kind items in one list), `type-scale-14-12.md`, `blocks-are-real-code.md`.
Grammar: `SurfaceCard kind="list" label labelEnd` (`frame/SurfaceCard/index.d.ts`), `Badge`. Code: `fe/apps/admin/src/components/composites/AdminRowsCard/index.tsx` (`labelEnd`), labels built in the `AdminHealth` read (`fe/apps/admin/src/hooks` view builders).

## Admin activity card ("admin.view.workspace", e-mail, time, workspace button)
Vì sao: SAI — one row per console action: the title is the raw action key "admin.view.workspace", the line "admin@example.test · 10:21 9 thg 11, 2026", and at the end a neutral pill with the workspace name ("Tiệm hoa Bình An") that links to it (a row action). The title must be a Vietnamese label ("Xem workspace"); the workspace-name pill is long for an action button and reads as a tag, not a link.
Luật: `type-scale-14-12.md`, `table-heroui-native-section-head.md` (links in rows: inline "↗" for text links).
Grammar: `ListRowData action: { label, href }` (`composite/ListRow/index.d.ts`) -> prefer `Link` ("↗") (`leaf/Link`). Code: `fe/apps/admin/src/components/composites/AdminRowsCard/index.tsx` (`itemOf`).

## Application errors card (chip "connection 4 (24 giờ)", rows with a code line)
Vì sao: SAI — the label has a pink chip "connection 4 (24 giờ)" (a raw kind key plus a mixed-language window, and an error count is work to look at so pink is fine, but the key "connection" is not a label), rows repeat "connection" as the title with the workspace button, a 12 muted time and a mono `Code` bar with the message ("Telegram trả về 401"). The title should say what failed ("Lỗi kết nối") and the code line is the right place for the raw message.
Luật: `type-scale-14-12.md`, `table-heroui-native-section-head.md`.
Grammar: `SurfaceCard labelEnd` + `Code` (`leaf/Code/index.d.ts`) in `ListRowData detail`. Code: `fe/apps/admin/src/components/composites/AdminRowsCard/index.tsx`.

## Empty, loading and error states
Vì sao: each card carries its own `EmptyNotice`; the first read renders the same cards as skeletons; a failed read draws the soft retry band with a line about what to do (`errorHint`). Not visible in the shots.
Luật: `pink-page-surface-rule.md` (empty/loading/error inside the block).
Grammar: `SlotView errorLayout="band"` (`@nivo-lite/agent-sdk/client`), `EmptyNotice` (`composite/EmptyNotice/index.d.ts`).

## Top bar (title, destinations, language, theme, account)
Vì sao: CHƯA RÕ — the white bar carries the product name "Bảng điều khiển đội NIVO" (bold text), then the destinations "Workspace" and "Sức khỏe nền tảng" as `sm` pills (the open one is `alternative`, the other `neutral`), and at the end the round language dropdown, the sun/moon switch and the account avatar menu with the e-mail and sign out. The language, theme and account controls follow the locale-switch rule. No owner law says destinations of a console are `sm` pill buttons in the bar rather than tabs or a sidebar; the customer console uses a sidebar and header tabs. The first destination also reads like part of the title.
Luật: `locale-switch-round-dropdown.md` (round dropdown, never a pill), `nivo-surface-layering.md` (top bar is white chrome), `page-header-left-sublabel-xs.md` (sm buttons carry no icon).
Grammar: `TopBar brand navigation actions menu` (`composite/TopBar/index.d.ts`), `NavLandmark layout="bar"`, `Button size="sm"`, `DropdownMenu`, `Switch`, `AvatarButton` (`frame/NavLandmark`, `leaf/Button`, `branch/DropdownMenu`, `leaf/Switch`, `leaf/AvatarButton`). Code: `fe/apps/admin/src/components/blocks/AdminHeader/component.tsx`.

## Phone: top bar (390)
Vì sao: SAI — the bar spends the width on the hamburger, the language button, the theme switch and the avatar, leaving the product name cut to "Bảng điều khiển đ…". The destinations move to the left drawer (correct, the hamburger is in the bar, unlike the customer console). The brand should keep its full text (or shrink to a short mark) and the language/theme controls should move into the drawer.
Luật: `type-scale-14-12.md`, `page-header-left-sublabel-xs.md`.
Grammar: `TopBar menu={{ visibility: "compact" }}` with `Drawer placement="left"` (`composite/TopBar/index.d.ts`, `frame/Drawer/index.d.ts`). Code: `fe/apps/admin/src/components/blocks/AdminHeader/component.tsx`.
