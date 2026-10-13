/** The workspace and event whose queued simulation status the caller wants. */
export interface GetInboundSimulationStatusRequest {
    /** The workspace selected in the request header. */
    readonly workspaceId: string
    /** The inbound event returned by the request mutation. */
    readonly id: string
}
