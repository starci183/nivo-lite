/** What cancelAgentRun takes. */
export interface CancelAgentRunRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The run to stop. */
    readonly runId: string
}
