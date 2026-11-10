/** What acceptAgentWorkflowTemplate takes. */
export interface AcceptAgentWorkflowTemplateRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent holds the workflows. */
    readonly installationId: string
    /** The workflow. */
    readonly workflowId: string
    /** The template version to accept. */
    readonly templateVersion: number
    /** Why the version was made, as the history shows it. */
    readonly note: string
    /** The newest version number the caller read; a newer one refuses the change. */
    readonly expectedLatest?: number | null
}
