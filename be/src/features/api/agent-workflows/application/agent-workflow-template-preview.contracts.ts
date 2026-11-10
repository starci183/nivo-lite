/** What agentWorkflowTemplatePreview takes. */
export interface AgentWorkflowTemplatePreviewRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent holds the workflows. */
    readonly installationId: string
    /** The workflow. */
    readonly workflowId: string
    /** The template version offered. */
    readonly templateVersion: number
    /** The language of the names; Vietnamese unless en is named. */
    readonly locale?: string | null
}
