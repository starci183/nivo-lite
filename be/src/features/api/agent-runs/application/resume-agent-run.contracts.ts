/** What resumeAgentRun takes. */
export interface ResumeAgentRunRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The parked run. */
    readonly runId: string
    /** Why it runs again, in a few words. */
    readonly reason: string
}
