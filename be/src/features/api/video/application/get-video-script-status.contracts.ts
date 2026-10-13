/** The queued operation in the selected workspace. */
export interface GetVideoScriptStatusRequest {
    /** Authenticated workspace selection. */
    readonly workspaceId: string
    /** Stable operation id returned by requestVideoScript. */
    readonly id: string
}
