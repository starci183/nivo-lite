/** What get agent knowledge takes. */
export interface GetAgentKnowledgeRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
}
