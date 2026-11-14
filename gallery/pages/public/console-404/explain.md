---
title: Không tìm thấy trang (trong console)
route: /workspaces/<ws>/<unknown>
area: public
---
# 404 trong console

Block `AppNotFound` (components/blocks/AppNotFound/component.tsx) rendered inside the console frame by the catch-all route `(console)/[...rest]`. Shots `1440.png`, `390.png`; `before/1440.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Next overlay is dev tooling.

## Thanh trên cùng (workspace NIVO, ngôn ngữ, giao diện sáng/tối, avatar)
Vì sao: console top bar on white with the workspace identity, the round language button, a theme switch and the Sprout avatar. The theme switch is a toggle that is not mentioned in any law and Grammar-theme rule says dark resolves from tokens only: CHƯA RÕ whether a visible sun/moon toggle is wanted.
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`, `owner-colors-exact.md` (dark only from theme tokens).
Grammar: `TopBar`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`; `ThemeSwitch` composite.

## Thanh bên trái (Tổng quan, Đầu vào, Trò chuyện / Điều hành: Second Brain / Thiết lập: Agent, Đội ngũ, Kết nối, Credit & gói)
Vì sao: SAI — (partly right, see the flagged part) white sidebar with a right border, nav groups with 12 muted group labels, each item an icon + 14 label, a pink count chip on Second Brain (73 = work waiting on the owner). A collapse button at the top.
Luật: `nivo-surface-layering.md` (white sidebar), `table-heroui-native-section-head.md` (pink chip only for work waiting on owner), `type-scale-14-12.md`.
Grammar: `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`; `ConsoleSidebar` composite; `Badge`.

## Dải đầu trang "Không tìm thấy trang"
Vì sao: SAI — the header band is the pink background colour (not white `--surface`) and the title repeats the notice's own message right below it; the band must be white with a bottom border and the notice should not repeat the same sentence as the title.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md` (header band = surface), `page-header-left-sublabel-xs.md`.
Grammar: `Pane area="head" surface`, `PaneHead`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/PaneHeader/index.d.ts`.

## Thông báo giữa trang (biểu tượng địa cầu, "Không tìm thấy trang", mô tả, nút "Về tổng quan →")
Vì sao: frameless empty notice centred in the well with one primary commit and an end arrow because it navigates; the icon tile is grey, the message 14 bold, the description muted. Frameless is correct (the earlier version drew a white card).
Luật: ui-laws "EmptyNotice on a pane is frameless", `owner-colors-exact.md`.
Grammar: `EmptyNotice frame="frameless" actionEndArrow`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Nút trợ lý (hình tròn góc dưới phải)
Vì sao: the floating assistant opener that lives on every console page.
Luật: `suggestion-button-sm.md` (assistant drawer), `grammar-core-heroui.md`.
Grammar: `PaneDrawerOpener`, `node_modules/@starci/grammar/dist/core/composite/PaneDrawerOpener/index.d.ts`.
