---
title: Agent / Đang chạy / Menu ⋯ của card đang mở
route: /workspaces/<ws>/agents
area: agents-catalog
---
Route: `/workspaces/<ws>/agents`, the same page as `dang-chay`, with the ⋯ menu of the first card (Kế toán) open (no hover or focus ring). A different state of the same screen, so its own folder (gallery README state rule). The round "N" button is the Next dev overlay; the guide bubble is hidden by default and does not appear.

## Menu ⋯ của card (đang mở)
Vì sao: a small popover under the ⋯ button of the card, right-aligned to it, with the commands of that agent: "Mở", "Thêm agent cùng vai trò" (only for a role that runs several agents, for managers), "Tạm dừng" (or "Tiếp tục" while the agent is paused) and "Gỡ". Plain text rows, no icons. Opening it never follows the card link. "Gỡ" asks first in an `AlertDialog` (what stops, what stays); "Tạm dừng" runs at once and toasts "Đã lưu"; "Mở" goes to the agent; "Thêm agent cùng vai trò" opens the create dialog with the role chosen.
Luật: `surfacecard-zones-api.md`, `type-scale-14-12.md` (14 text, no icons on rows).
Grammar: `SurfaceCard kind="body" menu={{ label, entries }} wholeAction` (`frame/SurfaceCard/index.d.ts`), `DropdownMenuEntry`. Code: `blocks/AgentCatalog/cards.tsx` (`menuEntriesOf`).

## Các card và phần còn lại của trang
Vì sao: unchanged from `dang-chay` (the menu floats over the card below the button, the other two cards and the roles list stay as they are); see that folder's `explain.md` for the header band, the cards, the foot figures and the roles list.
Luật: `pink-page-surface-rule.md`, `CARDS-FOR-COLLECTIONS`.
Grammar: `Grid kind="cards"`, `SurfaceCard kind="body"` (`frame/Grid/index.d.ts`, `frame/SurfaceCard/index.d.ts`). Code: `blocks/AgentCatalog/component.tsx`.

## Nút tròn NIVO AI (guide bubble, ẩn mặc định)
Vì sao: nút trợ lý nổi KHÔNG còn trong ảnh: mặc định ẩn, chỉ hiện khi chủ bật "Hiện trợ lý NIVO" trong menu avatar, và khi hiện nó nằm sát góc dưới phải (cách mép 8px) nên không đè hàng nào của trang; khi ẩn không vẽ gì nổi. Vì vậy không còn nút nào che nút "Tạo agent" của hàng vai trò. Trạng thái bật được chụp ở `shell/khung-chung-tro-ly`.
Luật: `nivo-surface-layering.md`.
Grammar: `AvatarButton size="floating"` (`leaf/AvatarButton/index.d.ts`). Code: `blocks/GuideBubble/index.tsx`, `classNames.ts` (không thuộc lane này).
