/** What agentWorkflows takes. */
export interface AgentWorkflowsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent holds the workflows. */
    readonly installationId: string
    /** The language of the names; Vietnamese unless en is named. */
    readonly locale?: string | null
}
