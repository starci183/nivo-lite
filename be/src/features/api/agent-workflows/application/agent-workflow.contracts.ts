/** What agentWorkflow takes. */
export interface AgentWorkflowRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent holds the workflows. */
    readonly installationId: string
    /** The workflow. */
    readonly workflowId: string
    /** The language of the names; Vietnamese unless en is named. */
    readonly locale?: string | null
}
