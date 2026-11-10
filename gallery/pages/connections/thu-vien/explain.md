---
title: Kết nối / Thư viện
route: /workspaces/<ws>/connections (tab Thư viện)
area: connections
---
# Kết nối, tab Thư viện

Block `ConnectionLibrary` (components/blocks/ConnectionLibrary/component.tsx) with composite `ConnectionLibraryTile`, `ConnectionInterestButton`. Shots `1440.png`, `390.png`; `thu-vien-tien-ve` is the same tab filtered to Tiền về. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang và tầng tab 1 (Đã kết nối 5, Thư viện 34)
Vì sao: SAI — (partly right, see the flagged part) same band as the hub (breadcrumb, title, status line, "+ Thêm kết nối", tab layer one with grey chips); the library tab is selected. The same repeated counts defect as the hub.
Luật: `page-header-left-sublabel-xs.md`, `table-heroui-native-section-head.md`.
Grammar: `PageHeader tabs`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Tầng tab 2 (Tất cả 34, Kênh chat 5, Tiền về 5, Google 2, API và dữ liệu 9, Bán hàng 10, Kế toán 3)
Vì sao: the second tab layer in the white band under layer one, same 14/40/500, underline on a full-width separator, grey count chips: per the law. Seven category tabs plus counts overflow on 390 (not folded into "More").
Luật: `page-header-left-sublabel-xs.md` (second tab layer lives in the white band), `surfacecard-zones-api.md` (extra tabs fold into More on mobile).
Grammar: `PageHeader subTabs`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Ô tìm "Tìm kết nối"
Vì sao: SAI — the search field sits on the pink well above the first group as a loose control; the zones law puts a block's own search in its header, and the search here searches a whole page rather than one block; as the field is page-level it should live in the band under the tabs or in the toolbar zone.
Luật: `pink-page-surface-rule.md` (a block's own filters/search live in its header), `surfacecard-zones-api.md`.
Grammar: `SearchField`, `node_modules/@starci/grammar/dist/core/leaf/SearchField/index.d.ts`.

## Đầu nhóm "Kênh chat 5", "Tiền về 5"
Vì sao: one group label per category with a grey count chip to its right (label + chip left), correct per the section-head law; each group is a grid of provider cards.
Luật: `table-heroui-native-section-head.md` (section head: label + count chip left).
Grammar: `Section title count`, `Badge`, `node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`.

## Lưới thẻ nhà cung cấp (Zalo OA, Bot Telegram, Facebook & Instagram, Telegram cá nhân, TikTok...)
Vì sao: SAI/OK split. OK: each provider is its own floating SurfaceCard on the pink (brand tile, name, a 14 muted sub-name, a status chip, a description, one neutral sm action pill), four per row. SAI: heights are uneven because sub-names wrap ("Nhiều kết nối · Thử nghiệm sớm" two lines) and descriptions run 2-4 lines, so the action buttons sit at different y; the status chip ("1 OA" success, "Đang thiết lập 2/4" warning, "Chưa nối" neutral) appears at different positions; five items in a group leave an orphan card on the second row; the card has four text layers (name, sub-name, chip, description) where two would do.
Luật: `nivo-surface-layering.md` (separate floating cards), `table-heroui-native-section-head.md` (one content per card), `suggestion-button-sm.md` (sm neutral pill, no icon).
Grammar: `Grid kind="cards"`, `SurfaceCard`, `Badge`, `Button size="sm"`, `node_modules/@starci/grammar/dist/core/frame/Grid/index.d.ts`; composite `ConnectionLibraryTile`.

## Thẻ "Sắp có" (TikTok, VNPAY, MoMo) với nút mờ "Tôi cần cái này"
Vì sao: SAI/OK split. A placeholder for a provider that does not exist yet with an "interest" pill (`ConnectionInterestButton`) is a useful signal; but the pill is a disabled-looking pale button (light grey text on near-white) that reads as unavailable although it is the only live action, and the card repeats the name with "Sắp có" as a sub-name.
Luật: `suggestion-button-sm.md`, `owner-colors-exact.md`.
Grammar: `Button intent="neutral" size="sm"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`.

## Khối "Công cụ agent dùng được" (thu-vien-tien-ve, SePay: chưa duyệt, chưa kiểm tra, chip, 3 công cụ)
Vì sao: SAI — visible only in the Tiền về filter: a wide card with a title, a 14 muted status line, two small chips right ("đang hoạt động", "có sẵn") and a nested "Công cụ đã ghim của SePay" list: a card in a card and chips in lowercase unlike every other chip; the section explains tools rather than connections, a different job from the cards above it.
Luật: `table-heroui-native-section-head.md` (no card in card; one content per card), `pink-page-surface-rule.md`.
Grammar: `SurfaceCard`, `DisclosureList`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/DisclosureList/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: not captured for this tab in a separate shot besides `390.png` (cards stack in one column); CHƯA RÕ for the category tab overflow.
Luật: `verify-against-visualize.md`.
Grammar: `Grid kind="cards"`.
