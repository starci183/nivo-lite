---
title: settings (đang tải)
route: xem ../settings/explain.md
area: team-permissions
---
# settings: trạng thái đang tải

> Shots missing: `1440.png`, `390.png` (a stack with a slow GraphQL answer is needed; none could run when the page was built).

## Khung trang và hai thẻ
Vì sao: `loading.tsx` draws the page's own header (breadcrumb without links, title, description are real text) and the same `WorkspaceSettings` block; the block's `SlotView` draws both cards with their real titles and the fields, the Lưu button, the preview and the two logo pills as geometry (skeleton parity), so nothing jumps when the settings arrive. Whether the member may edit comes from the session, known before the read, so a member who cannot change the settings never sees the foot appear while it loads.
Luật: `page-loading-own-shape.md`, `page-header-left-sublabel-xs.md`.
Grammar: `SlotView` (components/composites/SlotView), `SurfaceCard isLoading`, `Input isLoading`, `ComboBox isLoading`.
