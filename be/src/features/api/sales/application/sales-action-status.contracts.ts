/** The scoped Sales work item whose progress is requested. */
export interface SalesActionStatusRequest {
    /** The workspace selected by the authenticated caller. */
    readonly workspaceId: string
    /** The Sales work item id. */
    readonly id: string
}
