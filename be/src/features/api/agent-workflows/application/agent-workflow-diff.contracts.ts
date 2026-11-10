/** What agentWorkflowDiff takes. */
export interface AgentWorkflowDiffRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent holds the workflows. */
    readonly installationId: string
    /** The workflow. */
    readonly workflowId: string
    /** The version to read. */
    readonly number: number
    /** What to compare with: previous, version or template. */
    readonly against: string
    /** The version (or template version) to compare with; the workflow's own template version when absent. */
    readonly againstNumber?: number | null
}
