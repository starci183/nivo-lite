/** What ask knowledge takes. */
export interface AskKnowledgeRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The question. */
    readonly question: string
    /** The agent the question is asked as. */
    readonly module: string
    /** customer sees public passages only. */
    readonly audience: string
}
