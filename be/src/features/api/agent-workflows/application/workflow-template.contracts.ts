/** What workflowTemplate takes. */
export interface WorkflowTemplateRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The template. */
    readonly templateId: string
    /** The language of the names; Vietnamese unless en is named. */
    readonly locale?: string | null
}
