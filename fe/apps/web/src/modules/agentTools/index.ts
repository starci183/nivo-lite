import type { AgentToolsQuery } from "@/modules/api"

/**
 * The shapes the "NIVO tools" block of an agent's rights tab reads, taken from the generated GraphQL types (backend W5,
 * lanes/LG-REQUESTS-20261110.md "W5 → UX/UI" item 2). The wire sends `kind`, `origin` and `grant` as plain text; the block narrows them.
 */

/** One tool of `agentTools`. */
export type AgentToolWire = AgentToolsQuery["agentTools"][number]

/** Where a tool comes from: the agent's module, an ability ticked on an attached account, or the context reads every agent has. */
type AgentToolOrigin = "declared" | "ability" | "default-read"

/** The order the origin groups are drawn in. */
export const AGENT_TOOL_ORIGINS: ReadonlyArray<AgentToolOrigin> = ["declared", "ability", "default-read"]

/** The owner's grant as the row control shows it: no restricting row is automatic. */
export type AgentToolGrantMode = "auto" | "ask" | "never"

/** The grant a tool's row control shows: `ask` and `never` as stored, anything else (no row) automatic. */
export const grantModeOf = (grant: string | null): AgentToolGrantMode =>
    grant === "ask" || grant === "never" ? grant : "auto"

/** Narrows a text to a grant mode. */
export const isGrantMode = (value: string): value is AgentToolGrantMode =>
    value === "auto" || value === "ask" || value === "never"

/** The tools with one tool's grant set to a mode (the restricting row `ask` or `never`; `auto` leaves none), for a save shown at once. */
export const withGrant = (
    tools: ReadonlyArray<AgentToolWire>,
    toolId: string,
    mode: AgentToolGrantMode,
): AgentToolWire[] =>
    tools.map((tool) => (tool.id === toolId ? { ...tool, grant: mode === "auto" ? null : mode } : tool))
