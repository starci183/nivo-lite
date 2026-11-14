---
title: Second Brain › Chính sách (mở một quy định)
route: /workspaces/<ws>/brain?tab=policies&policy=<factId>
area: brain-billing
---
Route: `/workspaces/<ws>/brain?tab=policies&policy=<factId>`. REAL data: the first rule of the first group ("Biên lợi nhuận tối thiểu", 35%, owner viewing). Nothing mocked, nothing saved.

## Ngăn kéo quy định (tiêu đề, lý do của AI)
Vì sao: a drawer from the trailing edge, because editing one rule is a short form over the list's context. The title is the name the AI gave; the 12 muted line under it is the AI's reason (subtitle only directly under a title; no reason, no line).
Luật: `complex-content-page-not-drawer.md` (short form in a drawer), `surfacecard-select-subtitle.md`, `type-scale-14-12.md`.
Grammar: `Drawer` (`node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`). Code: `components/frames/PolicyDrawer`.

## Giá trị, Ai được biết, Có hiệu lực
Vì sao: the value is edited by the control its type asks for (here a percent field showing 35%); "Ai được biết" says who reads it (Mọi agent đọc) and has the owner-only switch "Khách được biết" (customer-facing agents may say it); "Có hiệu lực" is "Ngay bây giờ" or a date (start of that day, +07:00). Seen on real data: the heading "Ai được biết" draws larger and bolder than the other labels (Giá trị, Có hiệu lực, Lịch sử); it is a Fieldset legend against a Field label, a Grammar inconsistency, reported not worked around.
Luật: `surfacecard-select-subtitle.md`, `type-scale-14-12.md`.
Grammar: `Form`, `Field`, `Switch`, `Select` (`node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`, `leaf/Switch`). Code: `components/frames/PolicyDrawer`, `composites/PolicyValueField`.

## Lịch sử và nút
Vì sao: the history is a bordered list (surface in surface), newest version first ("35% · bản 1" over "Tài liệu · 11/11"); proposals waiting would be a second bordered list above it with "Dùng giá trị này" and "Bỏ". The footer is the decision group: "Huỷ" (neutral) and "Lưu" (the one primary).
Luật: `stop-card-design.md` (inner lists bordered), `red-budget-links-foreground.md` (one red CTA), CTA-1.
Grammar: `SurfaceCard kind="list"`, `Button intent="commit"`. Code: `composites/PolicyVersionLists`, `components/frames/PolicyDrawer`.
