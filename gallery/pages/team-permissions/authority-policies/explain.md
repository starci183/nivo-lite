---
title: Giao quyền / Chính sách
route: /workspaces/<ws>/authority/policies
area: team-permissions
---
# Giao quyền, Chính sách

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `AuthorityPolicies` (components/blocks/AuthorityPolicies/component.tsx). Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang và danh sách mục (Chính sách đang chọn)
Vì sao: SAI — same shell as `authority-goals` (white chrome, band without tabs, section list with the selected row greyed); blank 64px strip above the band.
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md`.
Grammar: `PageHeader`, `ListBox`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/ListBox/index.d.ts`.

## Thẻ biểu mẫu (Quy tắc kinh doanh, Cách phản hồi khách, Ngôn ngữ thương hiệu; nút "Lưu")
Vì sao: OK in structure: three Textarea fields, each 14/500 label, empty grey multi-line box and a 12 muted example hint under its own field ("Ví dụ: ..."), in ONE form card with the footer "Lưu" at the right edge; one content per card. The example hints under each field are field descriptions (allowed).
Luật: `table-heroui-native-section-head.md` (form footer in the card), `surfacecard-select-subtitle.md` (field title + description + content).
Grammar: `Textarea`, `SurfaceCard footers`, `Button intent="commit"`, `node_modules/@starci/grammar/dist/core/branch/Textarea/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Dòng "Quy tắc kinh doanh, cách phản hồi và ngôn ngữ thương hiệu. Mọi bộ phận AI đều làm theo." dưới thẻ
Vì sao: SAI — a loose caption under the card repeating the section subtitle in the list on the left; remove or make it the card's subtitle.
Luật: `surfacecard-select-subtitle.md` (subtitle rule).
Grammar: `SurfaceCard note`.

## Bố cục điện thoại 390
Vì sao: SAI — (partly right, see the flagged part) the section list is the page; the form is reached by tapping a row (not shown), blank strip defect.
Luật: `nivo-surface-layering.md`.
Grammar: `ListBox`.
