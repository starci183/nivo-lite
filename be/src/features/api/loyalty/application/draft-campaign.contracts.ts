/** The segment of draft campaign, as a named part. */
export interface DraftCampaignSegmentRequest {
    /** The tiers. */
    readonly tiers: ReadonlyArray<string>
    /** The inactive days. */
    readonly inactiveDays: number
    /** The birthday this month. */
    readonly birthdayThisMonth: boolean
    /** The min spend vnd. */
    readonly minSpendVnd: number
}

/** What draft-campaign takes. */
export interface DraftCampaignRequest {
    /** The workspace id. */
    readonly workspaceId: string
    /** The name. */
    readonly name: string
    /** The segment. */
    readonly segment: DraftCampaignSegmentRequest
    /** The brief. */
    readonly brief: string
}

/** What draft-campaign answers. */
export interface DraftCampaignResult {
    /** The campaign id. */
    readonly campaignId: string
    /** The status. */
    readonly status: string
    /** The recipients. */
    readonly recipients: number
    /** The draft. */
    readonly draft: string
}
