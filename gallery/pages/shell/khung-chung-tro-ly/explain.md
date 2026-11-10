---
title: Khung chung, đã bật trợ lý NIVO (menu avatar mở)
route: /workspaces/<ws>/agents/<module>/<installation>/... (mọi trang trong console)
area: shell
---
Cùng khung với `shell/khung-chung`, ở trạng thái khác: menu avatar đang mở, mục "Hiện trợ lý NIVO" đã được bật và nút trợ lý hiện ở góc dưới phải. Phần còn lại của khung (thanh trên, sidebar, dải đầu trang) được giải thích ở `shell/khung-chung`.

## Mục "Hiện trợ lý NIVO" trong menu avatar
Vì sao: một mục bật/tắt trong menu tài khoản, đứng trước các mục của chuông ở màn hình hẹp, nhãn "Hiện trợ lý NIVO" kèm mô tả "Nút trợ lý ở góc dưới." Mặc định TẮT; chọn thì nút hiện, bỏ chọn thì ẩn hẳn (không vẽ gì nổi). Lựa chọn nhớ theo trình duyệt (storage có try/catch, như lựa chọn sáng/tối), không theo tài khoản. Bản vẽ của chủ dùng công tắc; menu của Grammar 0.37.17 chưa có mục dạng công tắc (`DropdownMenuItem` không có `Switch`), nên dùng mẫu gần nhất: một section chọn nhiều có một mục, dấu tích của Grammar thay cho công tắc. Khoảng trống Grammar: mục menu có `Switch`.
Luật: `locale-switch-round-dropdown` (cài đặt của chủ nằm trong các điều khiển của thanh trên), `type-scale-14-12`, `owner-colors-exact`
Grammar: `DropdownMenu` `DropdownMenuSection.selection { mode: "multiple" }` `node_modules/@starci/grammar/dist/core/branch/DropdownMenu/index.d.ts`; `useTopBarOverflowEntries` `dist/core/composite/TopBar/index.d.ts` (mục của chuông vẫn nằm cùng menu); app `fe/apps/web/src/components/blocks/ConsoleHeader/component.tsx` (`guideBubbleSection`), `fe/apps/web/src/hooks/console/useConsoleHeader.ts`.

## Nút trợ lý ở góc dưới phải
Vì sao: nút tròn mặt NIVO AI sát góc, cách mép dưới và phải 8px, đúng bản vẽ chủ duyệt; chấm đỏ khi có việc chờ. Nó chỉ hiện sau khi chủ bật mục trên.
Luật: `nivo-surface-layering`, `verify-against-visualize`
Grammar: `AvatarButton size="floating"` `node_modules/@starci/grammar/dist/core/leaf/AvatarButton/index.d.ts`; app `fe/apps/web/src/components/blocks/GuideBubble/index.tsx`, `classNames.ts`.
