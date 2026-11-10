/** What workflowTemplates takes. */
export interface WorkflowTemplatesRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The module; all modules when absent. */
    readonly moduleKey?: string | null
    /** The language of the names; Vietnamese unless en is named. */
    readonly locale?: string | null
}
