---
title: Khung chung, đã bật trợ lý NIVO (menu avatar mở)
route: /workspaces/<ws>/agents/<module>/<installation>/... (mọi trang trong console)
area: shell
---
Cùng khung với `shell/khung-chung`, ở trạng thái khác: menu avatar đang mở, công tắc "Hiện trợ lý NIVO" đã bật và nút trợ lý hiện ở góc dưới phải. Phần còn lại của khung (thanh trên, sidebar, dải đầu trang) được giải thích ở `shell/khung-chung`.

## Mục "Hiện trợ lý NIVO" trong menu avatar
Vì sao: một mục công tắc trong menu tài khoản, đúng bản vẽ chủ duyệt: nhãn "Hiện trợ lý NIVO" và mô tả "Nút trợ lý ở góc dưới." ở đầu hàng, công tắc ở cuối hàng. Mặc định TẮT; bật thì nút hiện, tắt thì ẩn hẳn (không vẽ gì nổi), và menu vẫn mở khi bật tắt. Lựa chọn nhớ theo trình duyệt (storage có try/catch), không theo tài khoản. Các mục của chuông ở màn hình hẹp vẫn nằm cùng menu (`useTopBarOverflowEntries`).
Luật: `locale-switch-round-dropdown` (cài đặt của chủ nằm trong các điều khiển của thanh trên), `type-scale-14-12`, `owner-colors-exact`
Grammar: `DropdownMenuSwitch { kind: "switch", id, label, description, isSelected, onChange }` trong `DropdownMenuEntry`, `node_modules/@starci/grammar/dist/core/branch/DropdownMenu/index.d.ts` (0.37.19); `useTopBarOverflowEntries` `dist/core/composite/TopBar/index.d.ts`; app `fe/apps/web/src/components/blocks/ConsoleHeader/component.tsx` (`guideBubbleSwitch`), `fe/apps/web/src/hooks/console/useConsoleHeader.ts`.

## Nút trợ lý ở góc dưới phải
Vì sao: nút tròn mặt NIVO AI sát góc, cách mép dưới và phải 8px, đúng bản vẽ chủ duyệt; chấm đỏ khi có việc chờ. Nó chỉ hiện sau khi chủ bật mục trên. Ở 1440/1920 nó thấy ở góc dưới phải (trang agent: nâng lên trên composer, `bottom-28`); ở 390 trang agent là trang có composer và pane riêng nên nút không vẽ (luật của `GuideBubble`), ảnh 390 chỉ cho thấy menu và công tắc đã bật.
Luật: `nivo-surface-layering`, `verify-against-visualize`
Grammar: `AvatarButton size="floating"` `node_modules/@starci/grammar/dist/core/leaf/AvatarButton/index.d.ts`; app `fe/apps/web/src/components/blocks/GuideBubble/index.tsx`, `classNames.ts`.
