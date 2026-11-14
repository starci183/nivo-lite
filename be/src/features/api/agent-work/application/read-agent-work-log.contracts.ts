/** What the work log of one agent instance takes. */
export interface ReadAgentWorkLogRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The agent instance the log is about. */
    readonly installationId: string
}
