/** The workspace selected for this content read. */
export interface GetContentFiguresRequest {
    /** The workspace; the service verifies the caller's membership. */
    readonly workspaceId: string
}
