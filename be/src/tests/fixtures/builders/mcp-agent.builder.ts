import type { EntityManager } from "typeorm"

/** The explicit identities of one MCP credential scenario, supplied by the world. */
interface McpAgentIdentity {
    readonly userId: string
    readonly workspaceId: string
    readonly agentId: string
}

/** Persists the owner, the workspace (its owner member comes from the workspace trigger), one agent and its grant of the bank tool. */
export const persistMcpAgentRows = async (manager: EntityManager, identity: McpAgentIdentity): Promise<void> => {
    await manager.transaction(async (tx) => {
        await tx.insert("auth.users", { id: identity.userId })
        await tx.insert("public.workspaces", { id: identity.workspaceId, owner_id: identity.userId, name: "MCP proof" })
        await tx.insert("public.agents", {
            id: identity.agentId,
            workspace_id: identity.workspaceId,
            name: "Desk agent",
            handle: "desk",
            role: "Reads the bank feed",
            instructions: "Answer from the bank feed only.",
        })
        await tx.insert("public.mcp_tool_grants", {
            workspace_id: identity.workspaceId,
            agent_id: identity.agentId,
            tool: "sepay.transactions.list",
            mode: "auto",
        })
    })
}
