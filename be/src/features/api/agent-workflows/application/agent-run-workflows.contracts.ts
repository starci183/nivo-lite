/** What agentRunWorkflows takes. */
export interface AgentRunWorkflowsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent holds the workflows. */
    readonly installationId: string
    /** The runs, at most 100. */
    readonly runIds: ReadonlyArray<string>
}
