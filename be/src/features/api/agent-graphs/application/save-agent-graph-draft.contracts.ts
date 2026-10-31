/** What saveAgentGraphDraft takes. */
export interface SaveAgentGraphDraftRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The revision of the draft the editor read. */
    readonly rev: number
    /** The graph, as JSON text. */
    readonly documentJson: string
}
