# Agent workbench

The page where an owner works beside an agent: what the agent is doing, what waits for a person, what it has done and why.
[agent-work-core.md](agent-work-core.md) owns the work store and the action graph, [nivo-mcp.md](nivo-mcp.md) owns the tool door
and [agents-pages.md](agents-pages.md) owns Setup and the agent list; this page adds to them and never restates them. Paths are
from the repository root.

## The present architecture

- A workbench is a spec, not a page. A module declares its workbench as data in `packages/blocks-core` (the generic blocks in
  `packages/blocks-core/src/shared/blocks`, the module declarations, fixtures and messages in `packages/blocks-core/src/agents/<agent>`).
- One route draws every spec: the agent workbench slot `fe/apps/web/src/features/pages/AgentWorkbenchPage`, mounted at
  `/workspaces/<workspaceId>/agents/<module>/<installation>/workbench` by
  `fe/apps/web/src/app/[locale]/workspaces/[workspaceId]/(console)/agents/[module]/[installation]/workbench/page.tsx`, inside the agent
  frame. The host that reads the spec, runs its reads and actions and answers the blocks is `fe/apps/web/src/modules/workbench-host`.
- Blocks are generic and named for what they are (table, calendar, decision queue, conversation); no block carries a module name,
  takes children, JSX or class strings. A number no record backs is not drawn.
- Prototype or live is chosen once at the app root by a provider, never by an if/else on the mode in a page, a block or a hook.

## Rulings that still hold

- Sales and Chatbot are two agents on one customer record, and the handover happens inside the conversation. The customer sees
  one name.
- Role content is written in code, never AI-generated UI. A model's words appear only as a labelled draft a person can edit.
- One store with rights per agent (agent-work-core.md section 15.13). Agents read through NIVO MCP; people read through
  member-scoped GraphQL.
