/** What createAgentWorkflow takes. */
export interface CreateAgentWorkflowRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent holds the workflows. */
    readonly installationId: string
    /** The template to copy; none makes a blank workflow. */
    readonly templateId?: string | null
    /** The template version to copy; the newest when absent. */
    readonly templateVersion?: number | null
    /** The name of a blank workflow. */
    readonly name?: string | null
    /** The language of the names; Vietnamese unless en is named. */
    readonly locale?: string | null
}
