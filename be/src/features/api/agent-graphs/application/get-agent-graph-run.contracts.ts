/** What agentGraphRun takes. */
export interface GetAgentGraphRunRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The work item. */
    readonly workItemId: string
}
