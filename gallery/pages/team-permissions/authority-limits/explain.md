---
title: Giao quyền / Giới hạn
route: /workspaces/<ws>/authority/limits
area: team-permissions
---
# Giao quyền, Giới hạn

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `AuthorityLimits` (components/blocks/AuthorityLimits/component.tsx). Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang và danh sách mục (Giới hạn đang chọn)
Vì sao: SAI — same shell as the other Authority sections; blank 64px strip above the band.
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md`.
Grammar: `PageHeader`, `ListBox`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Thẻ "Luôn hỏi tôi trước khi" (Textarea và ví dụ)
Vì sao: SAI — (partly right, see the flagged part) one field in one card: title 14/500, multi-line Textarea, 12 muted example hint under it ("Ví dụ: khách mới đòi giá ngoài bảng giá, hoặc yêu cầu hoàn tiền."). A single field should sit flat on the pink without a card; here it is a card of its own with no footer, and the Save button is missing (where do changes save?): SAI.
Luật: `surfacecard-select-subtitle.md` ("Flat fields": single fields directly on the well; no card wrapper), `table-heroui-native-section-head.md` (form footer).
Grammar: `Textarea`, `Field`, `node_modules/@starci/grammar/dist/core/branch/Textarea/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Field/index.d.ts`.

## Nhãn "Dữ kiện bắt buộc" và thẻ ma trận ô chọn (6 cột x mỗi việc)
Vì sao: SAI — a repeated matrix: for each task (Trả lời khách, Chuyển lead, Phân loại, Nhắn lại, Gửi báo giá, Xác nhận đơn hàng, Gửi tin chăm sóc) a row title "Bắt buộc cho X · Agent" over six horizontally wrapped checkboxes (Tên khách, Nhu cầu, Điện thoại hoặc email, Khách hàng, Hàng hóa / dịch vụ, Số tiền (VND)); six checkbox labels crowd one line and the last one is cut at the card edge in the shot. The law says choice lists are `SurfaceCard kind="select"` rows (title + subtitle) with full-width dividers; a task x field matrix is better a table with checkbox cells (Grammar table with column per field) than a card of CheckboxGroups; the rows read as "Bắt buộc cho ..." (verb-led) while row titles must be nouns.
Luật: `surfacecard-select-subtitle.md` (choice lists; row titles are nouns), `table-heroui-native-section-head.md` (columned data is a Table).
Grammar: `DataTable` with checkbox cells, `node_modules/@starci/grammar/dist/core/branch/DataTable/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/CheckboxGroup/index.d.ts` (code uses `CheckboxGroup` + `Divider`, components/blocks/AuthorityLimits/component.tsx).

## Chân biểu mẫu (nút "Lưu")
Vì sao: CHƯA RÕ — the Save button is not in the shot (below the fold or absent); the block imports `Button` so it exists, but its position cannot be checked.
Luật: `verify-against-visualize.md`.
Grammar: `SurfaceCard footers`, `Button`.

## Bố cục điện thoại 390
Vì sao: SAI — (partly right, see the flagged part) list of sections as the page, blank strip defect as everywhere; a six-checkbox row would wrap to three lines on 390 (not shown).
Luật: `nivo-surface-layering.md`.
Grammar: `ListBox`.
