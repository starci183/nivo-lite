/** The bounded application request for reads the queued escalation decision and its answer delivery. */
export interface ChatAnswerStatusRequest {
    /** The workspace selector; the domain service proves membership. */
    readonly workspaceId: string
    /** The work item id. */
    readonly workItemId: string
}
