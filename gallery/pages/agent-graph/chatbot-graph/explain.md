# Agent / Graph tab: Chatbot

Route: `/workspaces/<ws>/agents/chatbot/<installation>/graph`. Mockup: `Agent-Graph.dc.html`. Shots: `1440.png`, `1920.png`, `390.png` (real dev data, taken with the gallery wait-ready helper). 1 workflow (Lễ tân) calling dashed blocks of other agents, each edge labelled with the outcome that calls it. The shot shows the OLD 29-step front desk and its call to the removed "Khách báo đã chuyển" workflow of Kế toán; re-shoot after the stack restart.

Grammar paths are under `node_modules/@starci/grammar/dist/core/` (version 0.37.8).

## Header band (trail, agent name, status, tabs)
Vì sao: the band never scrolls away, text flush left, one tab row (14px, 40px high, selected weight 500 with the underline on the separator); Graph sits between Công việc and Trò chuyện. Counts are 12px chips (pink only for work waiting on the owner).
Luật: `page-header-left-sublabel-xs.md`, `type-scale-14-12.md`, ui-laws "Tabs".
Grammar: `Page` `header` with `tabs={{ items, selectedKey }}` (app frame `AgentInstanceFrame`), `composite/PageHeader`.

## Canvas pane (full-bleed, no cards)
Vì sao: a graph pane is full-bleed Layout B, not a card on the pink well; the page does not scroll, the pane owns its own scroll, the title row stays pinned above and the legend pinned below.
Luật: ui-laws "Layout B", "Content width: chat, graph and editor panes are full-bleed", "Scroll"; `pink-page-surface-rule.md` (chrome = surface).
Grammar: `PaneGrid areas={{ base: ["canvas"] }}` + `Pane surface content="full"`, `PaneSection scroll`, `frame/PaneGrid/index.d.ts`, `frame/PaneSection/index.d.ts`.

## Title row ("Graph của Chatbot", count chip, "N đang chạy · M tắt", "Mở danh sách")
Vì sao: one head row: label 14/500 plus a count chip on the left, one command on the right; the running/off line is a 12px muted sub-line; the label uses the SHORT agent name, as the header does; the command is a neutral sm pill with no icon and goes to the list (Quy trình).
Luật: ui-laws "Section head: one row" and "Buttons: no sm button has an icon"; `table-heroui-native-section-head.md`; `suggestion-button-sm.md`; `type-scale-14-12.md`.
Grammar: `PaneHeader title description status actions` (`composite/PaneHeader/index.d.ts`) via app `PaneHead`; `Badge`; `Button intent="neutral" size="sm" href`.

## Workflow block (inputs, name, outcome chips)
Vì sao: each workflow is one white step card with a kind icon tile; the muted line is its INPUTS (trigger sources, or "Cửa mở · <required inputs>" for a workflow other workflows call; a workflow may have several inputs); the chips are its OUT contract outcomes (main outcome accent, the others neutral); a card draws at most 3 chips and folds the rest into "+N". Pressing a block opens that workflow.
Luật: `workflow-memory-contracts.md` (triggers, open entry, OUT contract), `flowgraph-card-style.md` (white card, kind icon tile, Vietnamese labels only), `type-scale-14-12.md`.
Grammar: `FlowGraph layout="steps"` node `{ label, description, chips: [{ label, tone: "accent" | "neutral" }], href }`, `branch/FlowGraph/types.d.ts` (`FlowGraphChip`).
Gap: the mockup puts input chips ABOVE the name and has no icon tile; Grammar only draws chips under the title, so inputs are the muted line.

## Edge with outcome label
Vì sao: a call runs from an outcome to the workflow it starts, so the edge carries the outcome name; curved connectors, no floating labels.
Luật: `workflow-memory-contracts.md` ("Calling the next workflow"), `flowgraph-card-style.md` (curved edges).
Grammar: `FlowGraphEdge { source, target, label }`, `branch/FlowGraph/types.d.ts`.

## Block of another agent (dashed)
Vì sao: a target in another agent is a dashed placeholder (not editable here); its title is the target WORKFLOW's name and a 12px muted line under it shows the owning agent (avatar and name), so the reader sees who will run it. Pressing it opens that agent's Graph.
Luật: `workflow-memory-contracts.md` ("Open entry", calls only within the workspace), `flowgraph-card-style.md` (placeholder = dashed card), `type-scale-14-12.md`.
Grammar: node `isPlaceholder`, `href`, `agent { name, avatar }` (0.37.5), `branch/FlowGraph/types.d.ts` (`FlowGraphAgent`). The avatar is the agent's picture from `calls[].agentAvatar`.

## Island (an unconnected workflow)
Vì sao: a graph may have disconnected islands (a cron or event workflow nothing calls); a paused workflow is dimmed.
Luật: `workflow-memory-contracts.md` ("A graph may have disconnected islands").
Grammar: node `isDimmed`; the steps layout places unconnected nodes apart (`branch/FlowGraph/steps.d.ts`). Islands wrap into rows (`FlowGraph islands="wrap"`, default since Grammar 0.37.8; at 1440 Sales shows 4 + 2, at 390 they stack one per row). Gap: there is no "Cụm rời" divider label.

## Canvas surface, zoom controls and rearranging
Vì sao: the canvas is a dotted surface (the graph pane is chrome, not a pink well); cards stay at reading size, so a graph larger than the pane is panned or zoomed, never shrunk; blocks can be dragged and "Sắp xếp lại" returns to the automatic layout. Verified on the real API: drag a block, reload, it stays where it was dropped (saved per agent after a 600 ms pause); the reset control restores the automatic position after reload.
Luật: `pink-page-surface-rule.md` (chrome = surface), `flowgraph-card-style.md`, ui-laws "Graphs".
Grammar: `FlowGraph background="dots" isEditable positions onPositionsChange resetLabel isInteractive showControls fit="readable"`, `branch/FlowGraph/index.d.ts`. Saved with `saveAgentGraphLayout`, read with `agentGraphLayout`.

## Legend caption
Vì sao: legends go OUTSIDE and under the content as a 12px muted caption, always visible (it is a pinned band under the scrolling canvas, never inside it); never a section description.
Luật: ui-laws "Section head: NO description… legends go UNDER the card as 12px muted captions"; `type-scale-14-12.md`.
Grammar: `Text size="xs" tone="muted"` in a `PaneSection` after the scrolling one. At 390 the round "N" in the corner is the dev-only badge and is ignored.

## Loading / error / empty
Vì sao: the first read shows a skeleton, a failed read shows the soft retry notice, an agent with no workflows shows a frameless empty line.
Luật: ui-laws "EmptyNotice on a pane is frameless".
Grammar: `FlowGraph isLoading emptyLabel`, `SlotView` (agent-sdk client).
