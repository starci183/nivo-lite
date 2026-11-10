---
title: Agent / Chợ agent
route: /workspaces/<ws>/agents/marketplace
area: agents-catalog
---
Route: `/workspaces/<ws>/agents/marketplace`, the second tab of the Agent page: approved agent templates, then the workflow templates of NIVO. Grammar paths are under `node_modules/@starci/grammar/dist/core/`. Shots are taken in the Next dev server (the round "N" button and the "Compiling" pill are Next dev overlays, not app UI); the floating round button is the guide bubble.

## Header band (trail "Tổng quan / Agent", title, description, "Tạo agent", tabs)
Vì sao: the three tabs are views of ONE page, so the band is the same on each: title "Agent", the trail has two levels, the description describes the page, "Tạo agent" stays at the end; only the tab underline moves.
Luật: `pink-page-surface-rule.md` (the band holds title, header buttons and page tabs), `page-header-left-sublabel-xs.md`.
Grammar: `Page header={{ breadcrumbs, title, description, actions, tabs }}` (`frame/Page/index.d.ts`). Code: `features/pages/AgentTemplatesPage`.

## "Mẫu agent" section (head and empty card)
Vì sao: a section head (Label 14/500; the grey count chip shows 0 too, as a section count is not a page tab; Grammar 0.37.8 `Section` draws it natively) then, because the items of this section are cards, an EMPTY state that is a card too: an icon tile, "Chưa có mẫu agent nào" and the muted line "Mẫu do shop khác đăng sẽ hiện ở đây sau khi được duyệt." With listings it is a 3-column grid of tiles.
Luật: `surfacecard-select-subtitle.md` (a subtitle only under a title), `table-heroui-native-section-head.md` (head = label + chip), `CARDS-FOR-COLLECTIONS`.
Grammar: `Section kind="region" title count` (`frame/Section/index.d.ts`), `EmptyNotice frame="card" message description iconSource` (`composite/EmptyNotice/index.d.ts`), `Grid kind="cards"` + `SurfaceCard kind="tile"`. Code: `blocks/AgentMarketplace/component.tsx`.

## "Mẫu quy trình" list card (rows, chips, chevron)
Vì sao: the head is the label with a grey count chip (the number of templates, 10 in the shot); one list card; each row is ONE target: a kind icon tile, the title (14/500), a one-line truncated description, then a chip line — the role chip (grey: Kế toán, Bán hàng, Chatbot), the input-source chip (`info` tone, the existing blue, no new colour; from the triggers of the template: SePay, Zalo OA hoặc Facebook, …) and the muted meta "· bản 4 · 1.284 shop dùng" — and a trailing chevron. The whole row opens the template; there are no "Xem mẫu" buttons and no caption under the card.
Luật: `surfacecard-select-subtitle.md` (row titles are nouns; no loose caption), `table-heroui-native-section-head.md`, `type-scale-14-12.md` (meta 12 muted).
Grammar: `SurfaceCard kind="list" label count items: ListRowData { leading.icon, description, detail, onPress }` (`frame/SurfaceCard/index.d.ts`, `surfaceCardData.d.ts`), `Badge tone` (`leaf/Badge/index.d.ts`). Code: `blocks/AgentWorkflowTemplates/component.tsx`, `modules/agentWorkflows/agentWorkflows.view.ts`.

## Template detail dialog
Vì sao: pressing a row opens a large dialog with the map of the newest version and what each version changed. Not open in the shots.
Luật: `flowgraph-card-style.md`, `blocks-are-real-code.md`.
Grammar: `Dialog size="lg"` (`frame/Dialog/index.d.ts`) with `FlowGraph` (`branch/FlowGraph/index.d.ts`). Code: `blocks/AgentWorkflowTemplates/component.tsx`.

## Phone layout (390)
Vì sao: one column under the band; the navigation opener is Grammar's round button row under the top bar (Grammar `WorkspaceShell` owns it); rows keep the icon, title, one cut line and the chip line.
Luật: `pink-page-surface-rule.md` (below lg the chrome folds).
Grammar: `WorkspaceShell navigationDrawer` (`frame/WorkspaceShell/index.d.ts`), `Page`.
