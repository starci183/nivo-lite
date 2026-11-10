---
title: Không tìm thấy trang (ngoài console)
route: /<unknown> (not-found.tsx)
area: public
---
# 404 ngoài console

`app/[locale]/not-found.tsx` rendering `AppNotFound` without the console frame. Folders `admin-suc-khoe` and `admin-404` are the same screen (old route names); superseded by this folder. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Next overlay is dev tooling.

## Dải đầu trang "Không tìm thấy trang"
Vì sao: SAI — a full-width band with a bottom border carrying the title flush left, but painted in the pink background instead of white, with no logo, no language switch and no way home in it; and the same sentence repeats in the notice below. Should be the white top bar of the entry/public shell (logo + round language dropdown) and the notice alone.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`, `locale-switch-round-dropdown.md`.
Grammar: `Pane area="head" surface`, `PaneHead`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`; or `TopBar`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`.

## Thông báo giữa trang (địa cầu, "Không tìm thấy trang", "Trang này không tồn tại hoặc bạn không còn quyền truy cập.", "Về tổng quan →")
Vì sao: frameless notice centred on the pink with one primary commit; correct pattern. The button says "Về tổng quan" (go to the console overview) even for a visitor who is signed out, where it would bounce to sign-in: CHƯA RÕ for the signed-out case.
Luật: ui-laws "EmptyNotice on a pane is frameless", `owner-colors-exact.md`.
Grammar: `EmptyNotice frame="frameless" actionEndArrow`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: SAI — (partly right, see the flagged part) the notice wraps to two lines and stays centred; same band defect (pink, no logo).
Luật: `nivo-surface-layering.md`.
Grammar: `EmptyNotice`.
