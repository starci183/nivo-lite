/** What listAgentGraphVersions takes. */
export interface ListAgentGraphVersionsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
}
