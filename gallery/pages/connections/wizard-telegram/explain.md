---
title: Trình thiết lập kết nối / Bot Telegram
route: /workspaces/<ws>/connections (Thư viện, bấm "Kết nối" / "Thêm")
area: connections
---
# Trình thiết lập: Bot Telegram

Frame `WizardFrame` (components/frames/WizardFrame) inside the wide Connections drawer; the step body comes from the provider wizard block (e.g. `ZaloWizard`, `MoneyWizard`, `TelegramWizard`, `MetaWizard`). Only a `1440.png` exists (no phone shot). Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Nền mờ, tên nhà cung cấp và nút đóng
Vì sao: the drawer dims the Connections hub behind it; "Bot Telegram" is the title and a round × closes it.
Luật: `grammar-core-heroui.md`.
Grammar: `Drawer`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`.

## Tên bước "Tạo bot"
Vì sao: the step's own name sits under the drawer title as a 14/500 line (`Section title` of the frame); correct. It repeats nothing, but it is directly above the Stepper that carries the phase names.
Luật: `type-scale-14-12.md`.
Grammar: `Section title`, `node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`.

## Thanh bước 4 giai đoạn (Thông tin, Cấp quyền, Kiểm tra, Giao agent)
Vì sao: OK — the four shared phases of every provider drawn as the horizontal Stepper, the first mark current in red, the others grey; the counter "Bước 1/4" agrees with the four phases here.
Luật: `type-scale-14-12.md`, `owner-colors-exact.md` (primary for the current mark).
Grammar: `Stepper` (`phases`), `node_modules/@starci/grammar/dist/core/composite/Stepper/index.d.ts`.

## Nội dung của bước
Vì sao: SAI — a neutral md button "Mở trang BotFather →", a bold line "Trên Telegram: BotFather", a sentence, a Select "Gửi tin nhắn" showing "/newbot" with the hint "Chọn đúng giá trị này trên Telegram.", and two instruction paragraphs; no field yet. A Select to confirm which command the owner sent ("/newbot") is a quiz control, not a form field; the instructions are two loose paragraphs (the step needs a numbered list); no input for the bot token appears on this step even though the last paragraph asks the owner to copy it.
Luật: `surfacecard-select-subtitle.md` (subtitle rule), `surfacecard-select-subtitle.md`.
Grammar: `Input`, `Select`, `Alert`, `Button`, `node_modules/@starci/grammar/dist/core/branch/Input/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/Select/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts`.

## Nút "Tiếp tục →" / "Đóng" và dòng "Bước 1/4"
Vì sao: SAI/OK split. OK: one primary commit with an end arrow and a grey ghost "Đóng", the button pair of a drawer step. SAI: the pair sits in the body flow (not in a footer zone), and the caption "Bước 1/4" below is a 12 muted counter placed under the buttons instead of in the header; the primary may render washed-out (disabled) until the fields are filled, which on screen looks identical to a broken button.
Luật: `surfacecard-zones-api.md` (footers), `page-header-left-sublabel-xs.md`, `owner-colors-exact.md`.
Grammar: `Button intent="commit" endArrow`, `Drawer footer`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`; composite `WizardFooter`.
