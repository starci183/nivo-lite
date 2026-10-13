/** The workspace-scoped lead whose wait should be read. */
export interface LeadWaitRequest {
    /** The workspace selected by the authenticated caller. */
    readonly workspaceId: string
    /** The workspace-scoped lead identifier. */
    readonly leadId: string
}
