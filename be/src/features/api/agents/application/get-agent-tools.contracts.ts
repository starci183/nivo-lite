/** What reading the tool set of one agent takes. */
export interface GetAgentToolsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves the owner or manager role. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
}
