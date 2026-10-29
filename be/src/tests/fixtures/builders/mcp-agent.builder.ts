import type { EntityManager } from "typeorm"
import { AgentEntity } from "@modules/domain/agents"
import { mcpToolGrantsEntities } from "@modules/domain/mcp-tool-grants"
import { WorkspaceEntity } from "@modules/domain/workspaces"

const [McpToolGrantEntity] = mcpToolGrantsEntities

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
        await tx.insert(WorkspaceEntity, { id: identity.workspaceId, ownerId: identity.userId, name: "MCP proof" })
        await tx.insert(AgentEntity, {
            id: identity.agentId,
            workspaceId: identity.workspaceId,
            name: "Desk agent",
            handle: "desk",
            role: "Reads the bank feed",
            instructions: "Answer from the bank feed only.",
        })
        await tx.insert(McpToolGrantEntity, {
            workspaceId: identity.workspaceId,
            agentId: identity.agentId,
            tool: "sepay.transactions.list",
            mode: "auto",
        })
    })
}

/** Grants an agent every tool of a connector in auto mode. */
export const grantConnectorTools = async (
    manager: EntityManager,
    workspaceId: string,
    agentId: string,
    tool: string,
): Promise<void> => {
    await manager.insert(McpToolGrantEntity, { workspaceId, agentId, tool, mode: "auto" })
}
