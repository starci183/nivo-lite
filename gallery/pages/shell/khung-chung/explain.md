---
title: Khung chung của console (thanh trên, sidebar, dải đầu trang, nút trợ lý)
route: /workspaces/<ws>/agents/<module>/<installation>/... (mọi trang trong console)
area: shell
---
Các vùng khung dùng chung cho MỌI trang agent. Giải thích MỘT lần ở đây; `explain.md` của từng màn chỉ giải thích nội dung trang. Ảnh mẫu: Sales > Bàn làm việc > Quy tắc.

## Thanh trên (logo, tên workspace, ngôn ngữ, sáng/tối, tài khoản)
Vì sao: chrome là bề mặt trắng phẳng, ngăn với trang bằng viền, không bóng. Bên trái logo NIVO và vai trò "Chủ sở hữu" mở menu workspace; bên phải chuông Thông báo, nút tròn đổi ngôn ngữ có dropdown VI/EN (không được vẽ lại, không là pill), công tắc sáng/tối và avatar (Sprout mặc định, không chữ cái). Menu avatar có thêm mục "Hiện trợ lý NIVO" (xem `shell/khung-chung-tro-ly`). Không có gì riêng của trang ở đây.
Luật: `nivo-surface-layering`, `pink-page-surface-rule`, `locale-switch-round-dropdown`, `page-header-left-sublabel-xs`
Grammar: `TopBar` `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts` qua `WorkspaceShell header` (`dist/core/frame/WorkspaceShell/index.d.ts`); `DropdownMenu`, `IconButton`, `Switch`, `AvatarButton`; app `fe/apps/web/src/components/blocks/ConsoleHeader/component.tsx`, `fe/apps/web/src/features/layouts/ConsoleLayout/component.tsx`.

## Nút chuông "Thông báo" (thanh trên)
Vì sao: một nút tròn viền (cùng loại với nút ngôn ngữ) đứng trước cụm ngôn ngữ / sáng-tối / avatar, dẫn tới trang Trò chuyện (/chat); chấm chú ý hiện khi còn tin chưa đọc (`useQueryChatUnreadSwr`, cùng nguồn với số trên mục Trò chuyện của sidebar). Ở 390 Grammar giữ một nút tuỳ biến trong thanh; nút thứ hai trở đi vào menu avatar qua `useTopBarOverflowEntries()`, nên chuông vẫn nằm trong thanh.
Chip "Founding" cạnh logo là nhãn phân loại: Badge không chấm (`badge-no-dot`).
Luật: `owner-colors-exact` (chấm chú ý là màu của Grammar), `nivo-surface-layering`, `locale-switch-round-dropdown` (cùng kiểu nút tròn)
Grammar: `TopBar customButtons` `{ id, glyph: "bell", label, href, badge }` và `useTopBarOverflowEntries` `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts` (0.37.15); app `fe/apps/web/src/components/blocks/ConsoleHeader/component.tsx`, `fe/apps/web/src/hooks/console/useConsoleHeader.ts`.

## Sidebar điều hướng (desktop)
Vì sao: thanh trắng cao hết khung, có viền ở cạnh; nhóm việc hằng ngày không có tiêu đề, "Điều hành" và "Thiết lập" là sublabel 12 muted; mục đang mở tô nền hồng nhạt; chip đếm hồng chỉ nằm ở Second Brain (73 việc chờ chủ), đúng luật hồng = chờ chủ; nút tròn « thu gọn ở góc.
Nhóm "Thiết lập" kết thúc bằng Cài đặt (/settings) rồi Nhà phát triển (/developers: khoá API và sự kiện gửi ra ngoài); cả hai chỉ chủ và quản lý thấy (`managerOnly` ở `DESTINATIONS`, `hooks/console/console.shared.ts`), biểu tượng `developers` = Heroicons `CodeBracketIcon`; menu avatar không có mục này. Shot thiếu: sidebar với mục Nhà phát triển.
Luật: `nivo-surface-layering`, `type-scale-14-12`, `table-heroui-native-section-head`
Grammar: `Sidebar` `groups` `items` `trailing` `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts` qua `WorkspaceShell navigation`; app `fe/apps/web/src/components/composites/ConsoleSidebar/index.tsx`, `fe/apps/web/src/components/blocks/ConsoleNavigation`.

## Hàng mở điều hướng ở 390
Vì sao: dưới 768 sidebar ẩn và ngay dưới thanh trên Grammar vẽ một hàng cao 64px (đúng RESPONSIVE-5, đường kẻ hết bề ngang) giữ nút tròn mở Drawer điều hướng. Hàng không còn là một nút "⋯" trơn: nút có nhãn chữ "Mở menu điều hướng" ngay bên phải (`navigationDrawer.rowTitle` = lời của nút), tên truy cập của nút vẫn là "Mở menu". Hàng cao 64px là của Grammar (không có prop bỏ hàng, và nút mở không thể dời vào thanh trên mà không bỏ `navigationDrawer`), nên giữ hàng và cho nó chữ.
Luật: `nivo-surface-layering`, `locale-switch-round-dropdown` (ngôn ngữ vẫn là nút tròn trong Drawer), `contexts/ui/composition.md` RESPONSIVE-5
Grammar: `WorkspaceShell navigationDrawer { title, openLabel, closeLabel, source, content, rowTitle? }` `node_modules/@starci/grammar/dist/core/frame/WorkspaceShell/index.d.ts` (0.37.6); app `fe/apps/web/src/features/layouts/ConsoleLayout/component.tsx`, `fe/apps/web/src/components/blocks/ConsoleDrawerContent/component.tsx`.
## Dải đầu trang agent (đường dẫn, dấu agent, tên, trạng thái, tab)
Vì sao: dải luôn trắng, căn trái, không cuộn mất. Đường dẫn "Tổng quan / Agent / Sales", dấu agent, tên 18, chip "Đang chạy", sublabel 12 muted "@sales · Bán hàng · SePay", rồi một hàng tab: Bàn làm việc, Công việc, Graph, Quy trình, Trò chuyện, Kết nối, Tri thức, Thiết lập. Chữ 14/500, tab chọn có gạch chân trên đường kẻ chung. Chip đếm 12px: xám = số lượng thường, hồng = việc chờ chủ (Tri thức 73). Ở 390 hàng tab cuộn ngang.
Luật: `page-header-left-sublabel-xs`, `type-scale-14-12`, `table-heroui-native-section-head`, `nivo-surface-layering`, `pink-page-surface-rule`
Grammar: `Page header` = `PageHeader { breadcrumbs, mark, title, status, meta, actions, tabs, subTabs }` `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`, `dist/core/frame/Page/index.d.ts`; `Tabs` `dist/core/branch/Tabs/index.d.ts`; `Badge` `dist/core/leaf/Badge/index.d.ts`; app `fe/apps/web/src/components/blocks/AgentInstanceFrame/component.tsx`.

## Nút ⋯ cuối dải đầu trang (menu agent)
Vì sao: một menu lệnh của agent (hồ sơ, đổi agent, đóng gói) ở cuối dải; trang không có lệnh chính nên chỉ còn nút tròn trung tính chỉ có icon.
Luật: `page-header-left-sublabel-xs`, `type-scale-14-12`
Grammar: `DropdownMenu` + `IconButton intent="neutral"` `node_modules/@starci/grammar/dist/core/branch/DropdownMenu/index.d.ts`, `dist/core/leaf/IconButton/index.d.ts` (dựng trong `AgentInstanceFrame/component.tsx`).

## Dải đầu lệch 64px (một dải hồng dưới thanh trên)
Vì sao: dải đầu bám ngay dưới thanh trên (y=64 ở 1440/1920; y=128 ở 390 vì hàng mở điều hướng 64px nằm giữa, ngoài vùng cuộn), không còn dải hồng 64px. Đã đo sau khi cuộn vùng cuộn của shell (`main.starci-core-workspace-shell-primary`) 400-500px trên overview, agents, templates, marketplace, team, brain, billing, account, knowledge, permissions, developers, hồ sơ agent, gói mẫu, Setup, Setup chung, Bàn làm việc, Công việc, Graph, Kết nối, Tri thức, Thiết lập, Trò chuyện, Đầu vào: `.starci-core-page-header` luôn có `top: 0` tương đối vùng cuộn, tức y=64 tuyệt đối. Nguyên nhân cũ (ảnh chụp trước đây): Grammar trước 0.36.2 đặt `top: var(--starci-core-band-height)` cho dải kể cả trong shell cố định; từ 0.36.2 luật chỉ áp khi CẢ TÀI LIỆU cuộn (`:not(:has([data-grammar-workspace-viewport="fixed"]))`), mà `ConsoleLayout` và `AdminLayout` đều `viewport="fixed"`. Mã app không thêm margin nào (không có `starci-core-band` hay `sticky` trong `fe/apps/web/src`).
Luật: `pink-page-surface-rule` (dải là chrome trắng và không cuộn mất), `nivo-surface-layering`
Grammar: `Page` header band sticky offset `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`, `dist/common/styles.css` (THE SCROLL LAW, `.starci-core-page > .starci-core-page-header { position: sticky; top: 0 }`); `WorkspaceShell viewport="fixed"` `dist/core/frame/WorkspaceShell/index.d.ts`.
## Nút trợ lý nổi (GuideBubble, ẩn mặc định)
Vì sao: nút tròn mặt NIVO AI mặc định ẨN nên ảnh khung chung không có nút nào nổi; chủ bật bằng "Hiện trợ lý NIVO" trong menu avatar (lựa chọn nhớ theo trình duyệt, như giao diện sáng/tối) và trạng thái bật nằm ở `shell/khung-chung-tro-ly`. Khi hiện, nút nằm sát góc dưới phải, cách mép dưới và phải đúng 8px ở mọi trang (`bottom-2 right-2`). Khoảng đệm cuộn dưới 768 (`h-20`: nút 61 + cách đáy 8 + hở) chỉ được vẽ khi nút hiện. Trang có composer và vùng cuộn riêng (Trò chuyện, Second Brain, mọi trang agent): ở 768 trở lên nút nâng lên trên composer (`bottom-28`), ở dưới 768 không vẽ.
Luật: `nivo-surface-layering` (một khối một việc, không đè nhau), `verify-against-visualize`
Grammar: `AvatarButton size="floating"` `node_modules/@starci/grammar/dist/core/leaf/AvatarButton/index.d.ts`; app `fe/apps/web/src/components/blocks/GuideBubble/index.tsx` (ẩn khi chưa bật), `component.tsx` (khoảng đệm + `overComposer`), `classNames.ts`, `fe/apps/web/src/hooks/guide/useGuideBubbleShown.ts`.
## Chỉ báo "Issues" của Next (chỉ dev, ngoài phạm vi)
Vì sao: chip "N" / "N Issues" ở góc dưới trái là công cụ của `next dev`, hiện trong mọi shot vì chụp từ dev server; không phải UI sản phẩm nên không đánh giá. Chụp lại với devIndicators tắt nếu cần ảnh sạch.
Luật: `verify-against-visualize`
Grammar: không có trong Grammar; do Next.js `devIndicators` (chỉ dev).

## Logo workspace trên thanh trên (thêm bởi trang Cài đặt workspace)
Vì sao: the lockup at the top left shows the workspace's own logo when the owner or a manager uploaded one on `/settings` (`useWorkspaceLogo` reads the same `workspaceSettings` answer as that page, so a saved or removed logo changes the top bar at once); with no logo, or while the answer is unread, Grammar draws its default mark as before. Name and role under it are unchanged. Not yet shot: needs a stack and a workspace with a logo.
Luật: `locale-switch-round-dropdown.md` (the lockup and its menu are not redrawn), `nivo-surface-layering.md`.
Grammar: `IdentityLockup logoSrc`, `node_modules/@starci/grammar/dist/core/composite/IdentityLockup/index.d.ts`.
