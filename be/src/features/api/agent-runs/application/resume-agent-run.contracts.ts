/** What resumeAgentRun takes. */
export interface ResumeAgentRunRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The parked run. */
    readonly runId: string
    /** Why it runs again, in a few words. */
    readonly reason: string
}

/**
 * What resumeAgentRun answers. No run is parked any more (every run is on a LangGraph thread, and a stopped thread run moves only through
 * its stop, answered with decideRunStop), so the door always answers `thread_run`. The door stays as a shell until the web drops it.
 */
export interface ResumeAgentRunAnswer {
    /** Always `thread_run`. */
    readonly kind: "thread_run"
    /** Never a step: nothing was resumed. */
    readonly stepKey: null
}
