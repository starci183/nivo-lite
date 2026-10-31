/** One OpenClaw agent per workspace and module: `ws-<first 16 hex of the workspace id>-<module>`. The agent is the tenant boundary on the OpenClaw side. */
export const agentIdFor = (workspaceId: string, module: string): string =>
    `ws-${workspaceId.replaceAll("-", "").slice(0, 16)}-${module.replace(/[^a-z0-9]/giu, "").toLowerCase()}`

/** The thread key inside that agent, in the `agent:<agentId>:<key>` form the gateway uses. */
export const threadKeyFor = (agentId: string, conversationId: string): string => `agent:${agentId}:${conversationId}`
