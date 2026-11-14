---
title: Agent / Thêm agent Bán hàng (hộp thoại)
route: /workspaces/<ws>/agents?create=sales
area: agents-catalog
---
Route: `/workspaces/<ws>/agents?create=sales`, opened from "Thêm Bán hàng" / "Tạo agent". The dialog is open over the dimmed Agent page; a phone gets a full-height sheet. Grammar paths are under `node_modules/@starci/grammar/dist/core/`. Shots are taken in the Next dev server (the round "N" button and the "Compiling" pill are Next dev overlays, not app UI); the floating round button is the guide bubble.

## Dialog frame (title, close, fixed head and footer)
Vì sao: title "Thêm agent Bán hàng" (14/500) at the start and a round ✕ at the end; the head and the footer stay fixed and only the body scrolls. The footer holds the neutral "Huỷ" and the ONE primary "Tạo agent" (md, with the + icon) on the right.
Luật: `surfacecard-select-subtitle.md` (footer carries the single primary), `page-header-left-sublabel-xs.md` (only a primary CTA has an icon; sm buttons none), `type-scale-14-12.md`.
Grammar: `Dialog size="md" title closeLabel footer` (`frame/Dialog/index.d.ts`), `Button intent="commit" startGlyph="plus"` (`leaf/Button/index.d.ts`). Code: `blocks/AgentCreateDialog/component.tsx`.

## Avatar ("Ảnh đại diện", "Tải ảnh lên", "Chưa tải thì dùng Sprout.")
Vì sao: the avatar comes first: the title above (Label 14/500), then only the current avatar (Sprout until an upload) with the "Tải ảnh lên" button and a muted 12 line. There is no picker of presets (owner: only Sprout + upload). After an upload an sm neutral "Dùng Sprout" resets it.
Luật: `surfacecard-select-subtitle.md` ("Avatar: only the Sprout default + Tải ảnh lên"), `flat fields` (title + content, no card).
Grammar: `Field label control` (`leaf/Field/index.d.ts`) around the app composite `AvatarEditor` (`Avatar` + `FileButton text`, `composite/FileButton/index.d.ts`; the reset is `Button size="sm" intent="neutral"`). Code: `blocks/AgentCreateDialog/component.tsx` (`PictureField`).

## Name and handle ("Tên", "Tên gọi")
Vì sao: two flat fields on the white dialog: title above the input (14/500, pink asterisk on the required "Tên"), the description 12 muted BELOW the input. The label "Tên gọi" has no "@" (the @ is the hint's business).
Luật: `surfacecard-select-subtitle.md` (flat fields: title Label 14/500 + description + content; spacing only between fields).
Grammar: `Input label description isRequired` (`branch/Input/index.d.ts`). Code: `blocks/AgentCreateDialog/component.tsx` (`NameFields`).

## Provider ("Provider", chip "Theo mẫu Bán hàng", một thẻ mỗi tài khoản)
Vì sao: the section label "Provider" carries the chip "Theo mẫu <Agent>": every CONNECTED ACCOUNT of a provider the template needs is a pre-ticked card (owner-approved drawing `lanes/drawings/quyen-tai-khoan-2.png`), and the owner may edit it before "Tạo agent". One bordered select card per account (it stands on the white dialog): the head is the provider logo, "<provider> · <account>" and its kind; the shop's default receiving account carries the green chip "Nhận tiền mặc định". For payment ONLY that default account is pre-ticked (QR always goes there); another payment account is a card with nothing ticked and is not attached unless the owner ticks something. The rows are the abilities (a checkbox each; a write ability also has the "Tự động | Hỏi" pill as the row control, dimmed while off). A provider the template names that is not connected is a dimmed line "Telegram · Chưa nối · khi nối sẽ hỏi gắn theo mẫu". The ticked accounts go out with the create button as `createAgentInstallation.providerRights[]` keyed by `connectionId` (verified end to end on a test agent).
Luật: `provider-rights-abilities` (per account; payment = default receiving account only), `surfacecard-select-subtitle.md` (every choice list is SurfaceCard kind="select"), `row-control-clearance`, `table-heroui-native-section-head.md` (label + chip at the start).
Grammar: `Section kind="region" title fact`, `SurfaceCard kind="select" selectionMode="multiple"` with `control` (`frame/SurfaceCard/index.d.ts`, `surfaceCardData.d.ts`), `IdentityLockup` (`composite/IdentityLockup/index.d.ts`), `Badge tone="success"` (`leaf/Badge/index.d.ts`). Code: `blocks/AgentCreateDialog/choices.tsx` (`ProvidersChoice`), `blocks/AgentCreateDialog/index.tsx` (`providersOf`), `composites/ProviderRightsCard`, `hooks/providerRights/useAgentAbilityProposal.ts`.

Retired by the 2026-11-13 rights model (one mode `auto | ask` per NODE; the agent attaches ACCOUNTS only): the per-ability checkbox rows and the per-ability "Tự động | Hỏi" pill in this section are being replaced by a plain list of accounts (ticked by the template), shared component `ProviderRightsCard` (see POLISH-SHARED). The shot predates that change.

## Start from ("Bắt đầu từ")
Vì sao: `SurfaceCard kind="select" selectionMode="single"`: "Bản sao của <agent>" ("Lấy sơ đồ, quyền, tri thức và cài đặt; không lấy kênh.") and "Thiết lập mặc định" ("Bắt đầu từ thiết lập gốc của vai trò."). Checkbox look for single choice too; no pink radio blocks.
Luật: `surfacecard-select-subtitle.md` (one look only), `ROW-TITLES-NOUNS`.
Grammar: `SurfaceCard kind="select" selectionMode="single"` (`frame/SurfaceCard/index.d.ts`). Code: `blocks/AgentCreateDialog/index.tsx` (`startOf`).

## Dimmed Agent page behind the dialog
Vì sao: the page stays visible under the 50% scrim so the owner keeps the context; Grammar draws the scrim over the shell too.
Luật: `pink-page-surface-rule.md` (chrome is not interactive under a modal).
Grammar: `Dialog` (`frame/Dialog/index.d.ts`).
