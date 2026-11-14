/** What agentTemplateNodeRequests takes. */
export interface GetAgentTemplateNodeRequestsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The workflow template. */
    readonly templateId: string
    /** The template version; the newest when absent. */
    readonly version?: number | null | undefined
}
