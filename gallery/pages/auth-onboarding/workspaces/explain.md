---
title: Workspace của bạn
route: /workspaces
area: auth-onboarding
---
# Workspace của bạn (sảnh)

Page `/workspaces` in `WorkspacesFrame` (Grammar `WorkspaceShell`): blocks `WorkspacesOverview`, `WorkspacesTable` (desktop) / `WorkspacesStack` (phone), `WorkspaceJoin`. Folders `no-access` and `onboarding` are the same page (the old routes redirect here). Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Next dev overlay in shots is not product UI.

## Thanh trên cùng (logo "NIVO os", nút ngôn ngữ, avatar)
Vì sao: SAI — (partly right, see the flagged part) the top bar is white chrome with a bottom border; right side: round language dropdown, then the account avatar (Sprout default). SAI on the logo: this bar draws "NIVO os" while the wizard and payment bars of the same shell draw plain "NIVO"; two logo variants in one shell. Should be one `BrandLogo` variant.
Luật: `nivo-surface-layering.md` (white chrome), `locale-switch-round-dropdown.md`, `page-header-left-sublabel-xs.md` (no image: Sprout avatar).
Grammar: `TopBar`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`; `AvatarButton`, `node_modules/@starci/grammar/dist/core/leaf/AvatarButton/index.d.ts`; `WorkspaceShell`.

## Dải đầu trang ("Workspace của bạn" + mô tả + nút "Tạo workspace mới")
Vì sao: the white header band with bottom border holds the title flush left and the one primary command at the far right; 390 stacks the button under the text. The description line under the title is a 14 muted sentence; the law's "no description under a label" applies to section heads, the page title band keeps its sublabel, so it is allowed; but the button is md while the owner's convention for header-band commands is sm.
Luật: `page-header-left-sublabel-xs.md`, `pink-page-surface-rule.md` (header band), `type-scale-14-12.md`.
Grammar: `PageHeader` / `PageIntro`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/PageIntro/index.d.ts`; `Button intent="commit"`.

## Thông báo "Bạn chưa thuộc workspace nào..." (chỉ ở /no-access)
Vì sao: SAI — (partly right, see the flagged part) a cautionary Alert explaining why the user landed here, above the list, drawn in the well; correct as an Alert (state, not a caption). It sits beside a list that already shows one workspace (NIVO), which contradicts its text: the shot data is inconsistent (SAI of the shot: the message says "no workspace" while a workspace row is listed).
Luật: `pink-page-surface-rule.md`, `verify-against-visualize.md`.
Grammar: `Alert tone="cautionary"`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts`.

## Đầu khối "Workspace của tôi" + số đếm
Vì sao: SAI — the label is on the left, the count "1" is plain right-aligned text (1440) and "· 1" (390); the law says counts are always a 12px chip next to the label ("never · N") and the head's right side holds only one navigation link.
Luật: `table-heroui-native-section-head.md` (tab counts, section head).
Grammar: `PaneHeader title count` / `Badge`, `node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Badge/index.d.ts`.

## Bảng workspace (Workspace, Trạng thái, Mở gần nhất, Hành động, Thêm)
Vì sao: SAI — (partly right, see the flagged part) columned data must be a Table in the HeroUI native frame (grey frame with header labels, white inner body, shadow no border); the row has avatar + name over "Chủ sở hữu · 2 người", status chip, relative time, "Mở →" and a ⋯ menu. Gaps: the "Hành động" and "Thêm" headers carry no data meaning (the actions column is one button; "Thêm" is a ⋯ menu) and there is no pagination footer in the grey frame; the "Mở" button now carries the end arrow only on the primary row (the most recently opened workspace, and only when no "Tạo workspace" action is on screen: see the red budget section, so in practice every "Mở" is neutral without an icon); the other rows are plain neutral buttons without an icon (only the primary CTA has an icon). Fixed 2026-11-13 (PL-6).
Luật: `table-heroui-native-section-head.md`, `page-header-left-sublabel-xs.md` (sm buttons no icon), `type-scale-14-12.md`.
Grammar: `DataTable` (`TableRowData`), `node_modules/@starci/grammar/dist/core/branch/DataTable/index.d.ts`; `Badge`, `Button size="sm"`; column API width/hideBelow in the table-law memory.

## Chip trạng thái "Đang hoạt động"
Vì sao: status as a plain soft chip with NO dot (a lifecycle label, not a live status; `badge-no-dot` reserves the dot for something running); the tone follows state (active success, pending warning, disabled muted, deleted danger), never raw colour.
Luật: `owner-colors-exact.md`, `table-heroui-native-section-head.md` (grey = quantity, pink = waiting on owner).
Grammar: `Badge tone`, `node_modules/@starci/grammar/dist/core/leaf/Badge/index.d.ts`.

## Khối "Tham gia workspace có sẵn" (nhãn, thẻ "Link mới", dòng chú thích)
Vì sao: SAI — a single input is wrapped in a white card with the title "Link mới" inside it while the real label "Tham gia workspace có sẵn" is a block label on the pink, plus a 12px explanatory caption under the card; the law says single fields sit flat on the pink well with title + description, no card; the caption is a settings explanation and must be a description under its field. Should be a flat field: Label "Tham gia workspace có sẵn", description, Input + button.
Luật: `surfacecard-select-subtitle.md` (flat fields; subtitle rule), `table-heroui-native-section-head.md` (ONE CONTENT PER CARD).
Grammar: `Input`, `Field`, `node_modules/@starci/grammar/dist/core/branch/Input/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Field/index.d.ts`; block `WorkspaceJoin`.

## Menu ⋯ của mỗi dòng
Vì sao: row commands beyond Open (rename, leave, delete) live in a dropdown menu, because three buttons per row would crowd the table.
Luật: `table-heroui-native-section-head.md`.
Grammar: `DropdownMenu`, `node_modules/@starci/grammar/dist/core/branch/DropdownMenu/index.d.ts`; composite `WorkspaceRowMenu`.

## Màn chào lần đầu (WorkspacesOverview welcome, không có trong shot)
Vì sao: CHƯA RÕ — a person with no workspace sees a soft card with the lobby mascot, a vertical Stepper of the set-up steps and a commit button; there is no screenshot of it here, so the law check (one content per card: it mixes text, stepper, button) cannot be made.
Luật: `verify-against-visualize.md`.
Grammar: `SurfaceCard treatment="soft" artwork`, `Stepper orientation="vertical"`, `Mascot`, `node_modules/@starci/grammar/dist/core/composite/Stepper/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: SAI — (partly right, see the flagged part) the table becomes a stack of row cards (avatar, name, meta, chip, time, "Mở →", ⋯), the join block moves under the list as a card with a label; layout follows "phone = list of rows". The count renders "· 1" (SAI, see above).
Luật: `table-heroui-native-section-head.md` (phone = list of rows), `nivo-surface-layering.md`.
Grammar: `Section`, `ListRow` (`ListRowData`), `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`; block `WorkspacesStack`.

## Ngân sách đỏ của sảnh (cập nhật 2026-11-13, Q-1)
Vì sao: màu đỏ chỉ ở MỘT nút "Tạo workspace": nút ở dải đầu trang khi đã có workspace, hoặc nút trong thẻ chào khi chưa có. "Mở" của từng hàng, "Chấp nhận" lời mời và "Tham gia" bằng link đều trung tính. Chỉ khi không có nút tạo nào trên màn hình thì "Mở" của hàng mở gần nhất mới được đỏ: quyết định đó là một hàm thuần (`lobbyPrimaryRowOf`, `hooks/lobby/lobby.shared.ts`), nên hai nút đỏ không thể hiện cùng lúc (mũi tên chỉ có ở nút đỏ).
Luật: `red-budget-links-foreground.md`. Shot thiếu: sảnh có hàng + lời mời, "Mở" trung tính.
