---
title: Đội ngũ / Thành viên
route: /workspaces/<ws>/team
area: team-permissions
---
# Đội ngũ, tab Thành viên

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `TeamPanes` (components/blocks/TeamPanes/component.tsx) with frames `TeamPeopleList`, `TeamDetail`, composites `TeamMemberDetail`, `TeamInviteDrawer`, `TeamInviteDetail`. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Overlays ("N", red dot) are not content.

## Khung console (thanh trên, thanh bên)
Vì sao: SAI — (partly right, see the flagged part) white top bar (workspace identity, round language dropdown, theme toggle, Sprout avatar) and white sidebar; the current item "Đội ngũ" is a pink pill. The theme toggle has no law behind it (CHƯA RÕ).
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`, `owner-colors-exact.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`.

## Dải đầu trang (đường dẫn, "Đội ngũ", mô tả, nút "+ Mời thêm người")
Vì sao: SAI — flush-left breadcrumb, title and 14 muted sublabel in the white band are right (no tab row: the page has one view); the invite command is the one primary CTA with a plus icon, correct for a primary CTA. Defects: a blank 64px pink strip above the band, and the band content starts at x 268 (full-bleed pane) while the same band on Billing starts at x 288 (80rem card pane) — fine for a Layout B pane but the band must align with its own body.
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md`, `pink-page-surface-rule.md`.
Grammar: `PageHeader`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`; `Button intent="commit"`.

## Cột trái: ô tìm "Tìm theo tên hoặc email" và tab lọc (Tất cả, Thành viên 2, Lời mời 0)
Vì sao: the list pane's head: search field then filter tabs (underline = secondary tabs) with grey count chips and grey 0 shown on filter tabs, per the law. "Tất cả" and "Thành viên" carry the same people (all vs members), the third tab is invites.
Luật: `surfacecard-zones-api.md` (filter and search zones), `table-heroui-native-section-head.md` (filter tabs show grey 0; counts as 12 chips).
Grammar: `SearchField`, `Tabs`, `node_modules/@starci/grammar/dist/core/leaf/SearchField/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`; frame `TeamPeopleList`.

## Dòng "2 người · 0 lời mời" và nhãn nhóm "Thành viên"
Vì sao: SAI — a 12px count summary line under the tabs duplicates the counts already on the tabs ("Thành viên 2", "Lời mời 0"); the group label "Thành viên" (12 muted Sublabel) repeats the tab name.
Luật: `page-header-left-sublabel-xs.md` (a group sublabel is a Grammar part), `table-heroui-native-section-head.md` (counts as chips, no description under label).
Grammar: `Sublabel`, `node_modules/@starci/grammar/dist/core/leaf/Sublabel/index.d.ts`.

## Danh sách thành viên (nivo-owner "Bạn", NIVO test staff)
Vì sao: rows = Sprout avatar + name 14/500 + 12 muted "Chủ sở hữu · email" and a "Bạn" tag; the selected row is a grey fill; hairline-free list inside a white pane. Correct list-row anatomy; the avatars use the Sprout default (no mascot/initials).
Luật: `page-header-left-sublabel-xs.md` (no image: Sprout avatar), `surfacecard-select-subtitle.md` (row title + subtitle), `type-scale-14-12.md`.
Grammar: `ListRow`, `Avatar`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Avatar/index.d.ts`.

## Thẻ chi tiết thành viên (avatar, tên, email, chip "Đang hoạt động", "Bạn", "Đăng nhập gần nhất")
Vì sao: one card = one fact set about the person: identity row with two chips (status success, "Bạn" neutral) and a divider then a labelled fact; correct as a detail card in the right pane. The "Bạn" tag appears in the list row AND in the detail chip (duplicate, minor).
Luật: `table-heroui-native-section-head.md` (one content per card; same-kind items one list), `type-scale-14-12.md`.
Grammar: `SurfaceCard`, `DescriptionList`, `Badge`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`; composite `TeamMemberDetail`.

## Khối "Vai trò" (Chủ sở hữu, Quản lý, Nhân viên) và dòng chú thích
Vì sao: SAI — the role of a person is a single choice shown as three `ChoiceChips` pills (selected = pink) in a card; the law says every choice list is `SurfaceCard kind="select"` (checkbox rows with title and subtitle, single selection) and segmented pills used to pick permissions are banned; the explanation "Chủ sở hữu có toàn quyền, kể cả gói và credit." is a loose 12px caption which should be the row subtitle of each role. Code: `TeamMemberDetail` uses `ChoiceChips` (components/composites/TeamMemberDetail/index.tsx).
Luật: `surfacecard-select-subtitle.md` (choice lists, subtitle rule), `suggestion-button-sm.md` (one pill pattern).
Grammar: `SurfaceCard kind="select" selectionMode="single"`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts` (not `ChoiceChips`, `node_modules/@starci/grammar/dist/core/composite/ChoiceChips/index.d.ts`).

## Bố cục điện thoại 390
Vì sao: SAI — nav row, blank strip, band with the full-width primary invite button on its own row, tab layer one, then the search and filters; the detail pane is below the list (not shown), the list takes the page. Blank strip defect as everywhere.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`.
Grammar: `PaneGrid`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`.
