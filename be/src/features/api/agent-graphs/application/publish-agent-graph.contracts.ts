/** What publishAgentGraph takes. */
export interface PublishAgentGraphRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** What the change was for. */
    readonly note: string
}
