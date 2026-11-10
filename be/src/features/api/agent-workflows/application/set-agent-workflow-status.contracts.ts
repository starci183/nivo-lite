/** What setAgentWorkflowStatus takes. */
export interface SetAgentWorkflowStatusRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent holds the workflows. */
    readonly installationId: string
    /** The workflow. */
    readonly workflowId: string
    /** active, draft or paused. */
    readonly status: string
}
