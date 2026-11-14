---
title: Contacts / Danh sách
route: /workspaces/<ws>/contacts
area: contacts
---
# Contacts, danh sách

Block `ContactsPanes` (components/blocks/ContactsPanes/component.tsx) in `Page measure="full"` with Grammar `Grid kind="main-rail" railPosition="leading" railWidth="compact"`. Approved drawing: `D:/starci-tmp/claude-20261105/lanes/contacts-20261113/contacts-drawing-v2.md` (owner "ok" 2026-11-14; v1 `contacts-drawing.md`, "ok chốt" 2026-11-13, before it). Source written 2026-11-14, type-checked only: NOT visually verified. Shots missing: no stack was running when this was written; `1440.png`, `390.png` to be taken in phase 2.

## Dải đầu trang: tiêu đề "Contacts", dòng mô tả 12, ô tìm kiếm ở cuối
Vì sao: white header band, title flush left with its sublabel ("Mọi người agent đang làm việc cùng, từ mọi kênh"); the one control of the page, the search of the people, sits at the band's end and is drawn only for who may read the list (owner and manager).
Luật: `page-header-left-sublabel-xs`, `pink-page-surface-rule` (chrome = surface), `type-scale-14-12`.
Grammar: `Page header { title, description, actions }`, `SearchField`.

## Cột danh sách (trái, từ lề trái của well)
Vì sao: the list is a LEFT COLUMN of the well (Grammar's compact leading rail, 14 to 16rem), starting at the well's own padding, the detail blocks fill the rest. The page takes `measure="full"`: with the default product measure the body is capped at 80rem and centred while the header band is flush left, so on a wide window the list floated mid-page with an empty gutter to its left.
Luật: `pink-page-surface-rule` (chrome = surface, only the well is pink), `page-header-left-sublabel-xs`.
Grammar: `Page measure="full"`, `Grid kind="main-rail" railPosition="leading" railWidth="compact"`.

## Thẻ danh sách
Vì sao: ONE white card on the pink well: its label "Tất cả" with the count (left out while more pages follow, since only what was read is counted), one row per person: avatar of the name, name 14 (the open person is the filled row), and under it ONE 12 muted line: when they were last seen at the start, the channels at the end as the Grammar's row of provider logos (each logo has an accessible name; a channel with no mark wears a chat glyph; never a text or a logo under 12). A person nobody knows shows "?" as the avatar and the channel's default name ("Khách Zalo"). The way to read the next page is the card's footer. No red anywhere: selecting is not a CTA.
Luật: `surfacecard-select-subtitle` (count next to the label), `red-budget-links-foreground`, `row-padding`, `type-scale-14-12`.
Grammar: `SurfaceCard label count footers`, `ListBox selectionMode="single" selectionIndicator="none"`, `LogoStack` (named logos), `Cluster justify="between"`; composite `ContactListCard`.

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
