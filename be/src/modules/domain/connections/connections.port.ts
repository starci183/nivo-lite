/** The agents bound to connections: the port the agent-connections capability implements for the connections it lists. */
export interface ConnectionAgentsDirectory {
    /** The ids of the agents that use a connection of the workspace, in the order they were attached, at most `limit`. */
    agentIdsOf(workspaceId: string, connectionId: string, limit: number): Promise<ReadonlyArray<string>>
}
