---
title: Hồ sơ của bạn
route: /workspaces/<ws>/profile
area: team-permissions
---
# Hồ sơ của bạn

> Shot note: the blank 64px pink strip above the header band described below is visible in THIS older capture (and at 390 as the nav row + strip). The newer audit capture of the same page (gallery/pages/audit/<page>) shows the band directly under the top bar, so treat that single defect as probably fixed; retake this shot to confirm. All other findings stand.

Block `AccountProfile` (components/blocks/AccountProfile/component.tsx) with composite `AvatarEditor`. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Khung console, dải đầu trang và tab (Hồ sơ đang chọn)
Vì sao: SAI — flush-left breadcrumb, title and a TWO-LINE sublabel ("Tên và ảnh đồng nghiệp thấy trong Office, trên khách hàng và trên việc bạn phụ trách.") then the tab layer; the sublabel wraps at 480px because its width is capped while the same band elsewhere uses the full width; defect: the blank 64px strip above the band.
Luật: `nivo-surface-layering.md`, `page-header-left-sublabel-xs.md`.
Grammar: `PageHeader tabs`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Thẻ hồ sơ (ảnh, "Đổi ảnh", ghi chú tệp, "Tên hiển thị", "Lưu hồ sơ")
Vì sao: OK in structure: an avatar with the Sprout default and one upload button ("Đổi ảnh", a neutral pill, no avatar picker), a 12 muted hint of file types under it, a required name field with its own 12 hint, a divider and the form footer "Lưu hồ sơ" in the card: one input group with its footer, which is where a card is justified. Defects: the card is a narrow 480px centred block while every other settings page is left aligned in the 80rem well (inconsistent measure); the name hint "Đồng nghiệp thấy tên này trong Office và trên khách hàng." repeats the band sublabel; "Office" is a term nobody defined in the UI.
Luật: `surfacecard-select-subtitle.md` (Avatar: Sprout default + "Tải ảnh lên", no picker; flat fields; form footer), `table-heroui-native-section-head.md` (form footer Huỷ/Lưu), `page-header-left-sublabel-xs.md` (Sprout avatar).
Grammar: `Form`, `Input`, `Avatar`, `FileButton`, `SurfaceCard footers`, `node_modules/@starci/grammar/dist/core/frame/Form/index.d.ts`, `node_modules/@starci/grammar/dist/core/composite/FileButton/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Avatar/index.d.ts`; composite `AvatarEditor`.

## Nhãn nút "Đổi ảnh" so với luật "Tải ảnh lên"
Vì sao: SAI — the owner wording for the upload is "Tải ảnh lên"; the button reads "Đổi ảnh", which promises a picker or replacement; wording must match.
Luật: `surfacecard-select-subtitle.md` (Avatar: only Sprout default + "Tải ảnh lên").
Grammar: `FileButton`, `node_modules/@starci/grammar/dist/core/composite/FileButton/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: SAI — (partly right, see the flagged part) card fills the width, nav row, blank strip and band as elsewhere (SAI blank strip).
Luật: `nivo-surface-layering.md`.
Grammar: `PaneGrid`.
