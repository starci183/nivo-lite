---
title: Kết nối / Telegram / chi tiết (đang thiết lập)
route: /workspaces/<ws>/connections/telegram/<id>
area: connections
---
# Chi tiết kết nối Telegram

Blocks `TelegramConnectionHead`, `TelegramConnectionFacts`, `TelegramConnectionSteps`, `TelegramConnectionNotices`, `TelegramConnectionEvents`. Shots `1440.png`, `390.png`; folder `connection-telegram-grants` is a twin capture of the same page, superseded by this folder. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console (thanh trên, thanh bên)
Vì sao: white console chrome, "Kết nối" current in the sidebar; theme toggle has no law behind it (CHƯA RÕ).
Luật: `nivo-surface-layering.md`, `locale-switch-round-dropdown.md`.
Grammar: `TopBar`, `Sidebar`, `node_modules/@starci/grammar/dist/core/composite/Sidebar/index.d.ts`.

## Dải đầu trang (đường dẫn 3 cấp, logo, "Telegram", chip "Đang thiết lập 2/4", dòng "Bot Telegram · -", nút "Tiếp tục thiết lập →", ⋯, tab Tổng quan / Sự kiện / Agent 1 / Cài đặt)
Vì sao: SAI/OK split. OK: flush-left breadcrumb, brand tile and title with a status chip, tabs in the band, and the ONE primary command "Tiếp tục thiết lập" with an end arrow because the setup is unfinished; the ⋯ menu holds the rest. SAI: the sublabel reads "Bot Telegram · -" with an empty dash value (missing bot username), and the breadcrumb ends "Bot Telegram / Telegram" (parent and page share the name).
Luật: `page-header-left-sublabel-xs.md`, `table-heroui-native-section-head.md` (tab counts grey; raw ids in a collapsed list).
Grammar: `PageHeader tabs`, `Button`, `DropdownMenu`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Khối "Thiết lập · bước 2/4" (Stepper + "Bot đã nhận token. Còn một bước:" + nút)
Vì sao: SAI — one card holds a Stepper AND, under a divider, a sentence with its own primary button "Tiếp tục thiết lập →" (the same command as the band button): two contents in one card (the law is one content per card) and the same command twice on the screen.
Luật: `table-heroui-native-section-head.md` (ONE CONTENT PER CARD).
Grammar: `Stepper`, `SurfaceCard`, `Button endArrow`, `node_modules/@starci/grammar/dist/core/composite/Stepper/index.d.ts`; composite `ConnectionSetupCard`.

## Khối "Thông tin kết nối" (Bot "-", Webhook "Cần kiểm tra · Chưa có tin nào", Agent dùng kết nối)
Vì sao: a details card with hairline rows; correct as a fact list but "Bot: -" shows an empty value as a hyphen and "Webhook" mixes a state word and a sentence.
Luật: `table-heroui-native-section-head.md`.
Grammar: `DescriptionList`, `node_modules/@starci/grammar/dist/core/composite/DescriptionList/index.d.ts`.

## Cột phải "Kiểm tra từng phần" + chip "Trực tiếp" (Token của bot, Webhook, Lỗi gần nhất)
Vì sao: SAI — a list card with a green left bar on the first row and plain rows after: a state encoding used nowhere else; three rows whose subtitles are sentences ("Telegram nhận ra bot -", "Chưa kiểm tra. Bấm Kiểm tra lại để hỏi Telegram."); floating in the right column where the aside law wants a white pane with a left border.
Luật: `nivo-surface-layering.md`, `owner-colors-exact.md`.
Grammar: `SurfaceCard` + `ListRow`, `Badge`, `node_modules/@starci/grammar/dist/core/composite/ListRow/index.d.ts`.

## Khối "Agent dùng kết nối này 1" (ô chọn "Giao cho agent", dòng Chatbot "Tự làm trong giới hạn ▾")
Vì sao: SAI — the head has label + count chip but the chip is at the far RIGHT; inside the card a full-width Select "Giao cho agent" is a header zone with a divider then the agent row; the same assignment control is a grey button in the head on the Zalo detail and a floating pill on the payOS detail: three forms of one command.
Luật: `table-heroui-native-section-head.md` (count chip next to the label), `surfacecard-zones-api.md`.
Grammar: `Select`, `SurfaceCard headers`, `node_modules/@starci/grammar/dist/core/branch/Select/index.d.ts`; composite `ConnectionGrantRows`.
