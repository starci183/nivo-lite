/** The selected workspace; membership is proved by the application capability. */
export interface ReadSalesWorkbenchRequest {
    /** The workspace selected in the request header. */
    readonly workspaceId: string
}
