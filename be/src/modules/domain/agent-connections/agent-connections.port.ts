import type { EntityManager } from "typeorm"

/** An active agent with the moment it was created, as the bindings of a connection list it. */
export interface BindingAgent {
    /** The agent. */
    readonly id: string
    /** The module key. */
    readonly module: string
    /** The display name. */
    readonly name: string
    /** When the agent was created. */
    readonly createdAt: Date
}

/** The agents the bindings read: the port the agents capability implements for the agent-connections capability. */
export interface BindingAgentsDirectory {
    /** The active agents among the given ids with the moment each was created, oldest first, at most `limit`. */
    activeCreatedAmong(
        workspaceId: string,
        agentIds: ReadonlyArray<string>,
        limit: number,
    ): Promise<ReadonlyArray<BindingAgent>>
    /** Whether the workspace holds the agent; the row is read with a shared lock so it stays until the transaction ends. */
    holds(workspaceId: string, agentId: string, manager: EntityManager): Promise<boolean>
}
