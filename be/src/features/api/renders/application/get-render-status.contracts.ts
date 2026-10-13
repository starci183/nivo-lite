/** The render to poll inside the workspace selected by the caller. */
export interface GetRenderStatusRequest {
    /** The active workspace; membership is checked before reading. */
    readonly workspaceId: string
    /** The queued render id. */
    readonly id: string
}
