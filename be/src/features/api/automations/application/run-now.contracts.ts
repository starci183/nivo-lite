/** What run now takes. */
export interface RunNowRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The template. */
    readonly templateKey: string
}
