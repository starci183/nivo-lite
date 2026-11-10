---
title: Đội ngũ / Quyền
route: /workspaces/<ws>/permissions
area: team-permissions
---
# Đội ngũ, tab Quyền (quy tắc theo việc)

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `PermissionPanes` (components/blocks/PermissionPanes/component.tsx) with composite `PermissionRuleForm` for the selected task. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang và tab (Thành viên / Quyền đang chọn)
Vì sao: SAI — same shell as `team` (white chrome, band with a 3-level breadcrumb Tổng quan / Đội ngũ / Quyền, title, sublabel, the primary "+ Mời thêm người", tab layer one); defects: the blank 64px strip above the band, and the invite command is shown on the Quyền tab where it does nothing for permissions. Sidebar duplicate "Quyền" item (see `team`).
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md`.
Grammar: `PageHeader tabs`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Cột trái: ô tìm "Tìm việc" và danh sách việc theo agent (Chatbot AI, Sales AI, Kế toán AI)
Vì sao: a Layout B list pane: search at the head, rows grouped under 12 muted agent sublabels with hairline separators between groups; each row = task name 14/500, optional 12 muted line "Chủ sở hữu hoặc Quản lý · 1 người bất kỳ" and a mode chip on the right.
Luật: `surfacecard-zones-api.md` (search zone), `page-header-left-sublabel-xs.md` (group sublabel), `type-scale-14-12.md`.
Grammar: `SearchField`, `ListRow`, `Sublabel`, `node_modules/@starci/grammar/dist/core/leaf/SearchField/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`.

## Chip chế độ ("Tự động", "Hỏi trước", "Tự động ≤ 19.999.999đ")
Vì sao: SAI — the chip colours carry meaning: green for Tự động, PINK for Hỏi trước; the law reserves pink for "work waiting on the owner" (needs action) while "Hỏi trước" is a normal policy setting, so a rule that is working is displayed as if it needs attention; the chip with the amount also truncates its limit and reads as a long chip (width unequal). Should be neutral/grey chips or a plain right-aligned muted value.
Luật: `table-heroui-native-section-head.md` (grey = plain quantity, pink only for work waiting on the owner), `owner-colors-exact.md`.
Grammar: `Badge tone`, `node_modules/@starci/grammar/dist/core/leaf/Badge/index.d.ts`; frame in `PermissionPanes` (`Badge`).

## Khung phải "Chọn một việc bên trái để đặt giới hạn và người duyệt."
Vì sao: the empty selection of a detail pane is a frameless EmptyNotice (icon tile, bold message, one sentence) centred in the pane; correct pattern. The editor for the selected task (`PermissionRuleForm`) is not shown.
Luật: ui-laws "EmptyNotice on a pane is frameless".
Grammar: `EmptyNotice frame="frameless"`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Biểu mẫu quy tắc của một việc (không có trong shot)
Vì sao: SAI — by code, `PermissionRuleForm` picks the mode with `ChoiceChips` and the approvers with `CheckboxGroup` inside a SurfaceCard; the mode (Tự động / Hỏi trước / Không bao giờ) is a single choice and must be `SurfaceCard kind="select"` (checkbox rows with subtitles). Not captured in a shot.
Luật: `surfacecard-select-subtitle.md`.
Grammar: `SurfaceCard kind="select"`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`; composite `PermissionRuleForm` (components/composites/PermissionRuleForm/index.tsx).

## Bố cục điện thoại 390
Vì sao: SAI — nav row, blank strip, band with a full-width invite button, tabs, then the search and the list; chips are right aligned and the last row is overlapped by the assistant dot. The detail pane is not reachable in the shot.
Luật: `nivo-surface-layering.md`.
Grammar: `PaneGrid`.
