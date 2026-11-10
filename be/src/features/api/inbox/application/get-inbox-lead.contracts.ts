/** One customer opened in the active workspace. */
export interface GetInboxLeadRequest {
    /** The workspace selected by the transport. */
    readonly workspaceId: string
    /** The customer id: a lead id, or the key of a customer that is no lead yet. */
    readonly id: string
}
