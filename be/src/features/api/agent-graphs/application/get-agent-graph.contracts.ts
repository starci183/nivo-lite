/** What getAgentGraph takes. */
export interface GetAgentGraphRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The language the cards are written in. */
    readonly locale: string | null | undefined
}
