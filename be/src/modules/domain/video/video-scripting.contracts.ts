/** The script operation returned before its agent job runs. */
export interface VideoScriptRequest {
    /** Stable generation id used for polling, including a possible retry. */
    readonly id: string
    /** The workspace-scoped project being scripted. */
    readonly projectId: string
    /** Queued or running. */
    readonly status: string
}

/** Progress of a queued script operation. */
export interface VideoScriptStatus extends VideoScriptRequest {
    /** Coarse completion percentage. */
    readonly progress: number
    /** The updated project when the script has been saved. */
    readonly resultId: string | null
    /** Stable failure code for the client catalog. */
    readonly errorCode: string | null
}
