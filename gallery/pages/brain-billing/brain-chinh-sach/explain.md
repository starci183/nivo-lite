---
title: Second Brain › Chính sách
route: /workspaces/<ws>/brain?tab=policies
area: brain-billing
---
Route: `/workspaces/<ws>/brain?tab=policies`. REAL data: workspace "Tiệm hoa NIVO (brain test)", derived policy layer live on dev (derivation `ready`, 7 AI-derived groups, 78 rows, the viewer is the owner). Nothing mocked. The shot is the first screen of the tab; the groups continue below. Only the `ready` derive state occurs in this workspace; `deriving`, `not_derived` and `failed` have no real occurrence on dev today and stay as the approved drawing `brain-policy-derived.png` (shot earlier with mocked payloads, not part of this folder).

## Đầu trang (đường dẫn, tiêu đề, mô tả, nút, tab)
Vì sao: the Second Brain header is flush left on the white surface: trail, title, one muted description line, "Thêm tài liệu" (alternative) and the overflow menu at the end, then the tab row with "Chính sách" selected. The chip on "Việc cần làm" is a number only (45); the "Chính sách" tab shows no chip because no proposal waits (`pendingTotal` 0).
Luật: `page-header-left-sublabel-xs.md`, `nivo-surface-layering.md`, `type-scale-14-12.md`.
Grammar: `Page header={{ breadcrumbs, title, description, actions, tabs }}` (`node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`). Code: `components/blocks/BrainPolicies/component.tsx`, `composites/BrainHeaderActions`.

## Nhóm chính sách do AI đặt tên (Báo giá và lợi nhuận, Đặt cọc và thanh toán, …)
Vì sao: the groups are the policies the AI derived from the truth graph (`groups[].subjectLabel` carries the derived group), each one a separate floating white card on the pink well with its label as the only text on pink; one content per card. Derived order and names are the back end's.
Luật: `pink-page-surface-rule.md`, `nivo-surface-layering.md`, `table-heroui-native-section-head.md` (label on pink, one content per card), `policy-from-truth-graph.md`.
Grammar: `SurfaceCard kind="list" label items` (`node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`). Code: `components/blocks/BrainPolicies/component.tsx` (`Groups`).

## Dòng chính sách (tên, nguồn và ai đọc, giá trị, Sửa)
Vì sao: a row is the name the AI gave (14/500) over a 12 muted line "Tài liệu · <document> · Khách được biết / Mọi agent đọc"; the value at the end (money `1.500.000 đ`, percent `35%`, durations and free text as the truth words them) and, for the owner, the neutral sm "Sửa" with no icon. A value scheduled for later would sit under the value as "từ dd/MM". A rule with no value in force yet but one scheduled (real: "Phí giao hàng nội thành", "Giờ đóng cửa ngày Giáng sinh", 5 rows) reads "Chưa đặt" in muted text with the scheduled value under it ("từ 01/12: 35.000 đ mỗi đơn", 12 muted), the source line "Chưa có nguồn" and the neutral "Đặt" instead of "Sửa", as in the approved drawing. Money values come as the truth words them: some arrive as "60.000" with no "đ" (backend request item 5 of the FE-LEAD section). Several rows share a name (the same rule from different documents); that is the data. A long text value takes the width of the row (it is the truth's own words); on the phone the name wraps and the source line is cut with an ellipsis.
Luật: `row-control-clearance.md`, `type-scale-14-12.md`, `page-header-left-sublabel-xs.md` (sm button, no icon), `badge-dot-or-not.md`.
Grammar: list row `title`, `description`, `value`, `action` with `actionPlacement="end"` (`ListRow`, `common/styles.css` value track `data-grammar-value`). Code: `components/blocks/BrainPolicies/component.tsx` (`itemOf`, `RowValue`).

## Trạng thái đọc (đang tải, lỗi, trống) và báo suy ra
Vì sao: the read goes through the one status recipe (`SlotView`); loading is `brain-chinh-sach-dang-tai`. The derive notice (running, failed) and the first-pass offer appear above the groups only in their states; in `ready` nothing is drawn there and there is no "Suy ra lại" (approved in the drawing).
Luật: FE-ERROR-1, `page-loading-own-shape.md`.
Grammar: `SlotView` (`@nivo-lite/agent-sdk/client`), `Alert tone="pending"|"neutral"`, `EmptyNotice`. Code: `hooks/brain/useBrainPolicies.ts`.
