/** What restoreAgentGraphVersion takes. */
export interface RestoreAgentGraphVersionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The version to go back to. */
    readonly versionId: string
}
