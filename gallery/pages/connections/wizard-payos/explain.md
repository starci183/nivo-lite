---
title: Trình thiết lập kết nối / Thanh toán qua payOS
route: /workspaces/<ws>/connections (Thư viện, bấm "Kết nối" / "Thêm")
area: connections
---
# Trình thiết lập: Thanh toán qua payOS

Frame `WizardFrame` (components/frames/WizardFrame) inside the wide Connections drawer; the step body comes from the provider wizard block (e.g. `ZaloWizard`, `MoneyWizard`, `TelegramWizard`, `MetaWizard`). Only a `1440.png` exists (no phone shot). Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Nền mờ, tên nhà cung cấp và nút đóng
Vì sao: the drawer dims the Connections hub behind it; "Thanh toán qua payOS" is the title and a round × closes it.
Luật: `grammar-core-heroui.md`.
Grammar: `Drawer`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`.

## Tên bước "Chọn môi trường"
Vì sao: the step's own name sits under the drawer title as a 14/500 line (`Section title` of the frame); correct. It repeats nothing, but it is directly above the Stepper that carries the phase names.
Luật: `type-scale-14-12.md`.
Grammar: `Section title`, `node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`.

## Thanh bước 4 giai đoạn (Thông tin, Cấp quyền, Kiểm tra, Giao agent)
Vì sao: SAI — the four shared phases are drawn as the horizontal Stepper with the first mark current, but the counter under the buttons says "Bước 1/5" (five steps) for a four-phase Stepper: phases and steps are two numbering systems on one screen.
Luật: `type-scale-14-12.md`, `owner-colors-exact.md` (primary for the current mark).
Grammar: `Stepper` (`phases`), `node_modules/@starci/grammar/dist/core/composite/Stepper/index.d.ts`.

## Nội dung của bước
Vì sao: SAI — an orange cautionary Alert "Thử nghiệm sớm", a single radio row "Chính thức" with its description, and a pink negative Alert "payOS không có chế độ thử nghiệm riêng mà NIVO biết được, nên chỉ có thể kết nối Chính thức.". A one-option "choice" drawn as a radio is not a choice; two stacked Alerts (orange + pink) say two near-identical warnings and the second reads like an error (negative tone) although nothing failed.
Luật: `surfacecard-select-subtitle.md` (no radio look), `owner-colors-exact.md`, `surfacecard-select-subtitle.md`.
Grammar: `Input`, `Select`, `Alert`, `Button`, `node_modules/@starci/grammar/dist/core/branch/Input/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/Select/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts`.

## Nút "Tiếp tục →" / "Đóng" và dòng "Bước 1/5"
Vì sao: SAI/OK split. OK: one primary commit with an end arrow and a grey ghost "Đóng", the button pair of a drawer step. SAI: the pair sits in the body flow (not in a footer zone), and the caption "Bước 1/5" below is a 12 muted counter placed under the buttons instead of in the header; the primary may render washed-out (disabled) until the fields are filled, which on screen looks identical to a broken button.
Luật: `surfacecard-zones-api.md` (footers), `page-header-left-sublabel-xs.md`, `owner-colors-exact.md`.
Grammar: `Button intent="commit" endArrow`, `Drawer footer`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`; composite `WizardFooter`.
