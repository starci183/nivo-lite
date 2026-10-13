/** The workspace selected for this content read. */
export interface GetContentWorkbenchRequest {
    /** The workspace; the service verifies the caller's membership. */
    readonly workspaceId: string
}
