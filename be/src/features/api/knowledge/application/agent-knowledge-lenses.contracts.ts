/** What the AgentKnowledgeLenses operation takes. */
export interface AgentKnowledgeLensesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
