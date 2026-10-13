/** The campaign to inspect within the selected workspace. */
export interface GetLoyaltyCampaignRequest {
    /** Workspace selected by the caller. */
    readonly workspaceId: string
    /** Campaign id. */
    readonly id: string
}
