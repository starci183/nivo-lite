---
title: Giao quyền / Phạm vi tự động
route: /workspaces/<ws>/authority/scope
area: team-permissions
---
# Giao quyền, Phạm vi tự động

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `AuthorityScope` (components/blocks/AuthorityScope/component.tsx). Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang và danh sách mục (Phạm vi tự động đang chọn)
Vì sao: SAI — same shell as the other Authority sections; blank 64px strip above the band.
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md`.
Grammar: `PageHeader`, `ListBox`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Nhãn nhóm agent trên nền hồng (Chatbot AI, Sales AI)
Vì sao: SAI — (partly right, see the flagged part) OK — one group label per agent sits on the pink above its card (14/500) and each agent's tasks are one card: "separate floating blocks, one block per job, only block labels on pink". The labels are 14/500 where the sublabel rule asks a 12px Sublabel for a group above a card: SAI (size).
Luật: `pink-page-surface-rule.md` (only block labels sit on pink), `page-header-left-sublabel-xs.md` (group sublabel above a card = 12, Grammar part).
Grammar: `Section title`, `Sublabel`, `node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Sublabel/index.d.ts`.

## Dòng việc với ba lựa chọn (Tự động, Hỏi trước, Không bao giờ)
Vì sao: SAI — each task's mode is a single choice drawn as three pill `ChoiceChips` (selected pink) in a loose row; the law says choice lists are `SurfaceCard kind="select"` (checkbox rows with title and subtitle) and that pills/segments to pick modes or permissions are replaced by it; there are 8+ tasks so the card repeats three chips per task with no explanation of what each mode means (the meaning should be the row subtitles). The pink selected chip also reads as "needs the owner".
Luật: `surfacecard-select-subtitle.md` (choice lists, subtitle rule), `table-heroui-native-section-head.md` (pink = waiting on owner).
Grammar: `SurfaceCard kind="select" selectionMode="single"`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`; code uses `ChoiceChips` (components/blocks/AuthorityScope/component.tsx line 87).

## Trường "Tự động dưới (VND)" (có − / +)
Vì sao: SAI — a `NumberField` with steppers to the right of "Gửi báo giá" / "Xác nhận đơn hàng" appears only for the tasks that have a cap; it is right-aligned to the card edge far from the chip it constrains, the label "Tự động dưới (VND)" is repeated per task, and the empty one shows blank rather than "không giới hạn".
Luật: `surfacecard-select-subtitle.md`, `type-scale-14-12.md`.
Grammar: `NumberField`, `node_modules/@starci/grammar/dist/core/leaf/NumberField/index.d.ts`.

## Chân biểu mẫu (nút "Lưu", dưới thẻ, bị cắt trong shot)
Vì sao: CHƯA RÕ — the shot ends inside the second card; the save control and any caption beneath are below the fold.
Luật: `verify-against-visualize.md`.
Grammar: `SurfaceCard footers`, `Button`.

## Bố cục điện thoại 390
Vì sao: SAI — (partly right, see the flagged part) list of sections as the page, blank strip defect as everywhere; the form is not shown on the phone.
Luật: `nivo-surface-layering.md`.
Grammar: `ListBox`.
