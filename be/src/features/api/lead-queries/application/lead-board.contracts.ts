/** The workspace selected for the lead board. */
export interface LeadBoardRequest {
    /** The selected workspace; the service verifies membership. */
    readonly workspaceId: string
}
