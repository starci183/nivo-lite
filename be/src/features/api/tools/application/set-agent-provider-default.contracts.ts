/** What setAgentProviderDefault takes. */
export interface SetAgentProviderDefaultRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The connected account (the connection) the agent is attached to, to become its default account of that provider. */
    readonly connectionId: string
}
