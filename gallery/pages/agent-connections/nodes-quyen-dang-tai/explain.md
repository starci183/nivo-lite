---
title: Quyền (nodes), đang tải
route: /workspaces/<ws>/agents/<module>/<installation>/connections
area: agent-connections
---
The loading shape of the tab: the real label of each card and the real column heads, skeleton rows only where data goes (three account rows, three operation rows). The note under each card is real text. Nothing else moves when the data arrives.

## Hình dạng khi tải
Vì sao: `page-loading-own-shape`: the chrome and every word that does not depend on the data are real; only data is skeleton. While the rights model is unknown (`undefined`) the page draws the `nodes` shape, never a guess at the ticks board and never a generic spinner. The label has no count chip until the count is known.
Luật: `page-loading-own-shape`.
Grammar: `SlotView` (`@nivo-lite/agent-sdk/client`) with a same-shape `placeholder`, `SurfaceCard isLoading`. Code: `RIGHTS_PAGE_PLACEHOLDER` (`AgentConnections/view.ts`), `STEP_RIGHTS_PLACEHOLDER` (`AgentStepRights/view.ts`).
