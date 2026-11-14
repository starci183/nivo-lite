/** What detachAgentProvider takes. */
export interface DetachAgentProviderRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The connected account (the connection). */
    readonly connectionId: string
}
