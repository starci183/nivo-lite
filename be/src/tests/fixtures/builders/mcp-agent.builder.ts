import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { EntityManager } from "typeorm"
import { agentsEntities } from "@modules/domain/agents"
import { toolGrantsEntities } from "@modules/domain/tool-grants"
import { workspacesEntities } from "@modules/domain/workspaces"

const [AgentEntity] = agentsEntities

const [WorkspaceEntity] = workspacesEntities

const [ToolGrantEntity] = toolGrantsEntities

/** The explicit identities of one MCP credential scenario, supplied by the world. */
interface McpAgentIdentity {
    readonly userId: string
    readonly workspaceId: string
    readonly agentId: string
    /** The module the agent serves: a staff-facing one reads the bank tools; the default is the customer-facing chatbot. */
    readonly module?: string
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
            module: identity.module ?? "chatbot",
            role: "Reads the bank feed",
            instructions: "Answer from the bank feed only.",
        })
        await tx.insert(ToolGrantEntity, {
            workspaceId: identity.workspaceId,
            agentId: identity.agentId,
            tool: TOOL.paymentCreditList,
            mode: "auto",
        })
    })
}
