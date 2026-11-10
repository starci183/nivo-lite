---
title: Agent / Mẫu của tôi
route: /workspaces/<ws>/agents/templates
area: agents-catalog
---
Route: `/workspaces/<ws>/agents/templates`, the third tab of the Agent page: newer versions offered to agents installed from a template, and the caller's own packaged templates. Grammar paths are under `node_modules/@starci/grammar/dist/core/`. Shots are taken in the Next dev server (the round "N" button and the "Compiling" pill are Next dev overlays, not app UI); the floating round button is the guide bubble.

## Header band (trail, title "Agent", "Tạo agent", tabs)
Vì sao: same band as the other two tabs (the tabs are one page).
Luật: `pink-page-surface-rule.md`, `page-header-left-sublabel-xs.md`.
Grammar: `Page header` (`frame/Page/index.d.ts`). Code: `features/pages/AgentTemplatesPage`.

## "Bản mới dành cho agent của bạn" card
Vì sao: a labelled list card of the newer versions offered to the agents (each with its changed parts and the one primary "accept"); the count chip appears with the first offer. Its items are rows in a card, so the empty answer is a card too: icon tile + "Chưa có bản mới nào."
Luật: `surfacecard-zones-api.md`, `CARDS-FOR-COLLECTIONS`, `surfacecard-select-subtitle.md` (subtitle only under a title).
Grammar: `SurfaceCard kind="list" label count items empty` + `EmptyNotice` (`frame/SurfaceCard/index.d.ts`, `composite/EmptyNotice/index.d.ts`). Code: `blocks/AgentTemplatesHub/component.tsx`.

## "Mẫu của tài khoản bạn" card
Vì sao: a labelled list card, a row per saved version ("Nhập vào đây" as its command, "Đưa lên chợ" in its menu); empty = icon tile + "Bạn chưa đóng gói quy trình nào." The page never swaps both cards for one bare notice (the slot "empty" now draws the two cards).
Luật: `CARDS-FOR-COLLECTIONS`, `table-heroui-native-section-head.md`.
Grammar: `SurfaceCard kind="list"` (`frame/SurfaceCard/index.d.ts`), `Dialog` for the value asked by a command. Code: `blocks/AgentTemplatesHub/component.tsx`, `index.tsx` (`withEmptyCards`).
