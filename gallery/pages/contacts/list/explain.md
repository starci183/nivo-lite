---
title: Contacts / Danh sách
route: /workspaces/<ws>/contacts
area: contacts
---
# Contacts, danh sách

Block `ContactsPanes` (components/blocks/ContactsPanes/component.tsx) in `Page` with Grammar `Grid kind="main-rail"`. Approved drawing: `D:/starci-tmp/claude-20261105/lanes/contacts-20261113/contacts-drawing.md` ("ok chốt" 2026-11-13). Shots missing: no stack was running when this was written; `1440.png`, `390.png` to be taken in phase 2.

## Dải đầu trang: tiêu đề "Contacts", dòng mô tả 12, ô tìm kiếm ở cuối
Vì sao: white header band, title flush left with its sublabel ("Mọi người agent đang làm việc cùng, từ mọi kênh"); the one control of the page, the search of the people, sits at the band's end and is drawn only for who may read the list (owner and manager).
Luật: `page-header-left-sublabel-xs`, `pink-page-surface-rule` (chrome = surface), `type-scale-14-12`.
Grammar: `Page header { title, description, actions }`, `SearchField`.

## Thẻ danh sách (cột trái, rộng compact)
Vì sao: ONE white card floating in the pink well: its label "Tất cả" with the count chip (left out while more pages follow, since only what was read is counted), one row per person (avatar of the name, name, and when they were last seen as a muted 12 line, and under it a row of small channel marks: Zalo, Facebook, Telegram; a channel with no mark shows its name), the open person drawn as a fill, a person nobody knows yet shows "?" as the avatar. The way to read the next page is the card's footer. No red anywhere: selecting is not a CTA.
Luật: `surfacecard-select-subtitle` (count chip next to the label), `red-budget-links-foreground`, `row-padding`.
Grammar: `SurfaceCard label count footers`, `ListBox selectionMode="single" selectionIndicator="none"`; composite `ContactListCard`.

## Khi nhân viên mở trang
Vì sao: the page is for owner and manager; staff get one centred notice with the way back to the dashboard, never an empty list that looks like "no contacts".
Luật: `unhandled-case-tells-customer` (a refusal is said in place).
Grammar: `EmptyNotice actionLabel actionEndArrow`.

## Đang tải / lỗi / chưa có ai
Vì sao: loading mirrors the page: the header is real text, the list draws five rows of the same shape as geometry (`LIST_PLACEHOLDER`); a failure is a band with its retry; nobody at all is the slot's empty notice.
Luật: `page-loading-own-shape`.
Grammar: `SlotView` (`errorLayout="band"`), `EmptyNotice`.

## Điện thoại 390
Vì sao: the grid collapses to one column; with no person open the list comes first, with one open the person comes first (`collapsedOrder`).
Luật: `table-heroui-native-section-head` (phone = list of rows).
Grammar: `Grid kind="main-rail" collapsedOrder`.
