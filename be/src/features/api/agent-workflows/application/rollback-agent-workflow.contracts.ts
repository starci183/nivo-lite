/** What rollbackAgentWorkflow takes. */
export interface RollbackAgentWorkflowRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent holds the workflows. */
    readonly installationId: string
    /** The workflow. */
    readonly workflowId: string
    /** The version to go back to. */
    readonly number: number
    /** Why the version was made, as the history shows it. */
    readonly note: string
    /** The newest version number the caller read; a newer one refuses the change. */
    readonly expectedLatest?: number | null
}
