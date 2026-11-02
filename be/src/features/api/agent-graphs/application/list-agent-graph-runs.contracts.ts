/** What agentGraphRuns takes. */
export interface ListAgentGraphRunsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** How many runs to answer. */
    readonly limit: number
}
