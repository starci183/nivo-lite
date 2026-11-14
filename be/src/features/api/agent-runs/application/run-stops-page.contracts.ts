/** What runStops takes: the workspace, and one page of its open stops. */
export interface RunStopsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** How many stops, 1 to 50 (20 when absent). */
    readonly limit?: number | null | undefined
    /** The `next` of the page before. */
    readonly cursor?: string | null | undefined
}
