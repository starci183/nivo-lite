---
title: Second Brain / Hỏi thử
route: /workspaces/<ws>/brain (tab Hỏi thử)
area: brain-billing
---
# Second Brain, Hỏi thử

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `BrainAsk` (components/blocks/BrainAsk/component.tsx), frame `AskQuestionForm`, composites `AskPassages`, `AskSeesTable`. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang và tầng tab 1 (Hỏi thử đang chọn)
Vì sao: SAI — same chrome; band title, sublabel "Hỏi như khách hoặc như đội, xem nguồn đã dùng và chỗ còn thiếu." and only a ⋯ menu; defect: the blank 64px pink strip above the band.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`, `page-header-left-sublabel-xs.md`.
Grammar: `PageHeader`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Thẻ biểu mẫu hỏi thử (dòng giới thiệu, Agent, Hỏi như, Câu hỏi, 0/500, nút "Tìm")
Vì sao: SAI/OK split. One input group in one card is right; Agent is a Select, the question a Textarea with a 0/500 counter and a primary "Tìm" with the search icon at the end (primary CTA may have an icon). SAI: the first line "Xem agent đọc được gì trước khi nó trả lời khách thật" is a 12px loose caption at the top of the card; the "Hỏi như" choice (Như khách hàng / Như đội ngũ) is drawn as two tinted pill chips with the selected one pink, which looks like suggestion chips or filter chips but is a 2-option mode switch; it should be pill `Tabs` or a `SurfaceCard kind="select"` list, never chips.
Luật: `surfacecard-select-subtitle.md` (choice lists; flat fields), `suggestion-button-sm.md` (one pill pattern), `surfacecard-zones-api.md` (pill tabs for 2-4 mode switch).
Grammar: `Select`, `Textarea`, `Button intent="commit"`, `Tabs appearance="primary"`, `node_modules/@starci/grammar/dist/core/branch/Select/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/Textarea/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`; frame `AskQuestionForm`.

## Bảng "Agent thấy gì" (cột Tri thức, Khách, Kế toán; 5 dòng tick và số)
Vì sao: SAI — (partly right, see the flagged part) OK — columned data is a native table in a grey frame (header labels in the grey, white rounded body, shadow, no border); cells use a check or a dash for "Khách" and a check + count for the agent. It sits in the right column as a floating card instead of a white aside pane with a left border (SAI for the aside law, see below). Header labels are 12px muted, correct.
Luật: `table-heroui-native-section-head.md` (native table), `type-scale-14-12.md`.
Grammar: `DataTable`, `node_modules/@starci/grammar/dist/core/branch/DataTable/index.d.ts`; composite `AskSeesTable`.

## Dòng chú thích dưới bảng ("So sánh Kế toán với khách. Chatbot chỉ đọc phần Công khai; ...")
Vì sao: SAI — a three-line 12px explanatory paragraph under the table; it explains the semantics, not a legend of the table's data, and should be a row subtitle or an ⓘ in the section head.
Luật: `surfacecard-select-subtitle.md`, `table-heroui-native-section-head.md` (descriptions become a 12 caption only for legends; ⓘ right in head).
Grammar: `Text size="xs" tone="muted"`, `node_modules/@starci/grammar/dist/core/leaf/Text/index.d.ts`.

## Cột phải như khung aside
Vì sao: SAI — the aside is two floating blocks on the pink; the layering law says the aside is a full-height white pane with a left border and below lg its blocks become the first blocks of the well. On 390 the order must put the table first.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`.
Grammar: `Pane area="aside" surface`, `PaneGrid`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`.

## Kết quả (đoạn trích, chỗ còn thiếu, không có trong shot)
Vì sao: CHƯA RÕ — the result state (`AskPassages`) is not captured.
Luật: `verify-against-visualize.md`.
Grammar: `SurfaceCard`, `ListRow`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.
