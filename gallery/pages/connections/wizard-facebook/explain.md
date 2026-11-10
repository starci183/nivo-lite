---
title: Trình thiết lập kết nối / Facebook & Instagram
route: /workspaces/<ws>/connections (Thư viện, bấm "Kết nối" / "Thêm")
area: connections
---
# Trình thiết lập: Facebook & Instagram

Frame `WizardFrame` (components/frames/WizardFrame) inside the wide Connections drawer; the step body comes from the provider wizard block (e.g. `ZaloWizard`, `MoneyWizard`, `TelegramWizard`, `MetaWizard`). Only a `1440.png` exists (no phone shot). Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Nền mờ, tên nhà cung cấp và nút đóng
Vì sao: the drawer dims the Connections hub behind it; "Facebook & Instagram" is the title and a round × closes it.
Luật: `grammar-core-heroui.md`.
Grammar: `Drawer`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`.

## Tên bước "Đăng nhập Facebook"
Vì sao: the step's own name sits under the drawer title as a 14/500 line (`Section title` of the frame); correct. It repeats nothing, but it is directly above the Stepper that carries the phase names.
Luật: `type-scale-14-12.md`.
Grammar: `Section title`, `node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`.

## Thanh bước 4 giai đoạn (Thông tin, Cấp quyền, Kiểm tra, Giao agent)
Vì sao: SAI — the Stepper marks "Thông tin" complete and "Cấp quyền" current (phase 2) while the counter under the buttons says "Bước 1/4": two numberings disagree on one screen.
Luật: `type-scale-14-12.md`, `owner-colors-exact.md` (primary for the current mark).
Grammar: `Stepper` (`phases`), `node_modules/@starci/grammar/dist/core/composite/Stepper/index.d.ts`.

## Nội dung của bước
Vì sao: SAI — two body paragraphs (the second in muted grey) and a pink negative Alert "Thử nghiệm sớm: ...", then a primary pill "Kết nối Facebook" and "Đóng". The Stepper marks "Thông tin" complete and "Cấp quyền" current (step 2) while the counter says "Bước 1/4": two different numberings; the early-access notice uses the negative (error) tone.
Luật: `type-scale-14-12.md`, `owner-colors-exact.md`, `surfacecard-select-subtitle.md`.
Grammar: `Input`, `Select`, `Alert`, `Button`, `node_modules/@starci/grammar/dist/core/branch/Input/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/Select/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts`.

## Nút "Tiếp tục →" / "Đóng" và dòng "Bước 1/4"
Vì sao: SAI/OK split. OK: one primary commit with an end arrow and a grey ghost "Đóng", the button pair of a drawer step. SAI: the pair sits in the body flow (not in a footer zone), and the caption "Bước 1/4" below is a 12 muted counter placed under the buttons instead of in the header; the primary may render washed-out (disabled) until the fields are filled, which on screen looks identical to a broken button.
Luật: `surfacecard-zones-api.md` (footers), `page-header-left-sublabel-xs.md`, `owner-colors-exact.md`.
Grammar: `Button intent="commit" endArrow`, `Drawer footer`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`; composite `WizardFooter`.
