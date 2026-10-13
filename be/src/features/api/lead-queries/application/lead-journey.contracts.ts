/** The lead journey the caller asks to read. */
export interface LeadJourneyRequest {
    /** The selected workspace; the service verifies membership. */
    readonly workspaceId: string
    /** The lead within that workspace. */
    readonly leadId: string
}
