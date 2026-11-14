import type { AgentToolsQuery } from "@/modules/api"

/**
 * The shapes the "NIVO tools" block of an agent's rights tab reads, taken from the generated GraphQL types (backend W5,
 * lanes/LG-REQUESTS-20261110.md "W5 → UX/UI" item 2). The wire sends `kind` and `origin` as plain text; the block narrows them.
 */

/** One tool of `agentTools`. */
export type AgentToolWire = AgentToolsQuery["agentTools"][number]

/** Where a tool comes from: the agent's module, a provider tool an attached account serves, or the context reads every agent has. */
type AgentToolOrigin = "declared" | "attached" | "default-read"

/** The order the origin groups are drawn in. */
export const AGENT_TOOL_ORIGINS: ReadonlyArray<AgentToolOrigin> = ["declared", "attached", "default-read"]
