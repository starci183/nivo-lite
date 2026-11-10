---
title: Agent / Đang chạy
route: /workspaces/<ws>/agents
area: agents-catalog
---
Route: `/workspaces/<ws>/agents`, the first tab of the Agent page: the agents of the workspace as cards, then the roles that can still be added. Grammar paths are under `node_modules/@starci/grammar/dist/core/`. Shots are taken in the Next dev server (the round "N" button and the "Compiling" pill are Next dev overlays, not app UI); the floating round button is the guide bubble.

## Header band (trail "Tổng quan / Agent", title, description, "Tạo agent", tabs)
Vì sao: the one band of the three tabs; "Tạo agent" is the one primary and opens the create dialog.
Luật: `pink-page-surface-rule.md`, `page-header-left-sublabel-xs.md`.
Grammar: `Page header` (`frame/Page/index.d.ts`). Code: `features/pages/AgentsCatalogPage`.

## "Agent của bạn" head
Vì sao: a section head, label + grey count chip (the number of agents). No role group rows ("Kế toán · 1 agent"), no "Thêm <vai trò>" buttons and no caption under the cards: another agent of a role is added with "Tạo agent". The chips and the search show only when there are more than 6 agents.
Luật: `table-heroui-native-section-head.md` (head = label + chip, no description), `surfacecard-select-subtitle.md` (no loose caption), `CARDS-FOR-COLLECTIONS`.
Grammar: `Section kind="region" title count` (`frame/Section/index.d.ts`). Code: `blocks/AgentCatalog/component.tsx` (`Team`), `hooks/agentCatalog/useAgentTable.ts` (`TEAM_FILTER_FROM`).

## Agent cards (3 columns, 8px apart, equal height)
Vì sao: one card per agent in a grid of three (two on a tablet, one on a phone), the gap is Grammar's `inline` step (8px); the agents that wait for the owner come first. The WHOLE card is a link to the agent. Inside: the avatar, the name (14/500) and the muted @handle, the status "Đang chạy" (a dot badge); under them the role chip (grey) and the channel chips (info tone: Telegram, Zalo, SePay), plus the card ⋯ menu at its top end (Grammar 0.37.10 `menu` with `wholeAction`; it never follows the card link): "Mở", "Thêm agent cùng vai trò" (managers, roles that run several), "Tạm dừng" or "Tiếp tục" (by the state of the agent) and "Gỡ", which asks first in an `AlertDialog` ("Gỡ <tên>?", what stops and what stays) before it removes. The menu is closed in the shot (one folder = one state). The chips follow, plus a red chip "<nhà cung cấp> chưa cấp quyền" for a connection the agent HAS whose status is not connected (error, pending, disconnected); an agent with no connection shows no red chip. The channel chips use the existing `info` tone (the app registers no violet; no new colour). The head shows its grey count chip, 0 included (Grammar 0.37.8 `Section`).
Luật: `CARDS-FOR-COLLECTIONS`, `type-scale-14-12.md`, `surfacecard-select-subtitle.md`.
Grammar: `Grid kind="cards" columns={3} gap="inline"` (`frame/Grid/index.d.ts`), `SurfaceCard kind="body" wholeAction height="fill"` (`frame/SurfaceCard/index.d.ts`), `Badge`, `Avatar` via the app `AgentMark`. Code: `blocks/AgentCatalog/component.tsx` (`AgentCard`).

## Foot of a card ("Việc 7 ngày", "Chờ bạn")
Vì sao: under one full-width line (edge to edge, no inset) two figures: the tasks the agent finished in 7 days and the items waiting for the owner; "Chờ bạn" is a pink chip when above zero (work waiting on the owner), plain otherwise. The numbers are the per-agent counts of the Tổng quan dashboard (last 7 days), not invented.
Luật: `surfacecard-zones-api.md` (footers[] zone is padded and divided by the shell), `CARDS-FOR-COLLECTIONS` (pink only for work waiting on the owner).
Grammar: `SurfaceCard footers=[{ kind: "custom" }]` (`surfaceCardData.d.ts`, `FooterZone`). Code: `blocks/AgentCatalog/component.tsx` (`Figure`), `hooks/agentCatalog/useAgentTable.ts`.

## "Thêm agent theo vai trò" list card
Vì sao: untouched by this change: one list card with its group chips in the filter zone and a row per role with its install command.
Luật: `surfacecard-zones-api.md`, `table-heroui-native-section-head.md`.
Grammar: `SurfaceCard kind="list" headers=[filter]` (`frame/SurfaceCard/index.d.ts`). Code: `blocks/AgentCatalog/component.tsx` (`Roles`).
