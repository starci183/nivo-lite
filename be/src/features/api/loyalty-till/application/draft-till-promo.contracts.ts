/** The segment of draft till promo, as a named part. */
export interface DraftTillPromoSegmentRequest {
    /** The tiers. */
    readonly tiers: ReadonlyArray<string>
    /** The inactive days. */
    readonly inactiveDays: number
    /** The birthday this month. */
    readonly birthdayThisMonth: boolean
    /** The min spend vnd. */
    readonly minSpendVnd: number
}

/** What draft-till-promo takes. */
export interface DraftTillPromoRequest {
    /** The name. */
    readonly name: string
    /** The brief. */
    readonly brief: string
    /** The segment. */
    readonly segment: DraftTillPromoSegmentRequest
    /** The authorization. */
    readonly authorization: string
}

/** What draft-till-promo answers. */
export interface DraftTillPromoResult {
    /** The campaign id. */
    readonly campaignId: string
    /** The status. */
    readonly status: string
    /** The recipients. */
    readonly recipients: number
    /** The draft. */
    readonly draft: string
}
