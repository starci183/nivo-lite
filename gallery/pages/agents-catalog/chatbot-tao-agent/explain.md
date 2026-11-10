---
title: Agent / Thêm agent Chatbot (hộp thoại)
route: /workspaces/<ws>/agents?create=chatbot
area: agents-catalog
---
Route: `/workspaces/<ws>/agents?create=chatbot`, opened from "Thêm Chatbot" / "Tạo agent". The dialog is open over the dimmed Agent page; a phone gets a full-height sheet. Grammar paths are under `node_modules/@starci/grammar/dist/core/`. Shots are taken in the Next dev server (the round "N" button and the "Compiling" pill are Next dev overlays, not app UI); the floating round button is the guide bubble.

In this shot the channels of the Chatbot role are already answered by another agent, so both rows are disabled with "<Agent> đang trả lời kênh này".

## Dialog frame (title, close, fixed head and footer)
Vì sao: title "Thêm agent Chatbot" (14/500) at the start and a round ✕ at the end; the head and the footer stay fixed and only the body scrolls. The footer holds the neutral "Huỷ" and the ONE primary "Tạo agent" (md, with the + icon) on the right.
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

## Channels ("Kênh")
Vì sao: a choice list = `SurfaceCard kind="select" selectionMode="multiple"`, bordered because it stands on the white dialog. One row per channel: the title is the provider ("Telegram", "Zalo OA"), the subtitle the account and its state ("@nivo_bot · đang trống"). A channel another agent of the role already answers is disabled and says "<Agent> đang trả lời kênh này". The title "Kênh" is the card label, with no description and no loose line about one agent per channel.
Luật: `surfacecard-select-subtitle.md` (every choice list is SurfaceCard kind="select"; a subtitle only under a title; no loose lines), `WHITE-LIST-BORDERED-CARD`, `CARD-NO-DESCRIPTION`.
Grammar: `SurfaceCard kind="select" selectionMode="multiple" items: SelectItemData` (`frame/SurfaceCard/index.d.ts`, `surfaceCardData.d.ts`). Code: `blocks/AgentCreateDialog/index.tsx` (`channelsOf`).

## Start from ("Bắt đầu từ")
Vì sao: `SurfaceCard kind="select" selectionMode="single"`: "Bản sao của <agent>" ("Lấy sơ đồ, quyền, tri thức và cài đặt; không lấy kênh.") and "Thiết lập mặc định" ("Bắt đầu từ thiết lập gốc của vai trò."). Checkbox look for single choice too; no pink radio blocks.
Luật: `surfacecard-select-subtitle.md` (one look only), `ROW-TITLES-NOUNS`.
Grammar: `SurfaceCard kind="select" selectionMode="single"` (`frame/SurfaceCard/index.d.ts`). Code: `blocks/AgentCreateDialog/index.tsx` (`startOf`).

## Dimmed Agent page behind the dialog
Vì sao: the page stays visible under the 50% scrim so the owner keeps the context; Grammar draws the scrim over the shell too.
Luật: `pink-page-surface-rule.md` (chrome is not interactive under a modal).
Grammar: `Dialog` (`frame/Dialog/index.d.ts`).
