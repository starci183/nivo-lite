/** What assign agent work takes. */
export interface AssignAgentWorkRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** What to do, as the person wrote it. */
    readonly text: string
}
