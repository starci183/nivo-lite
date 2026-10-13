/** What award-till-points takes. */
export interface AwardTillPointsRequest {
    /** The phone. */
    readonly phone: string
    /** The name. */
    readonly name: string
    /** The amount vnd. */
    readonly amountVnd: number
    /** The ref. */
    readonly ref: string
    /** The items. */
    readonly items: string
    /** The occurred at. */
    readonly occurredAt: string
    /** The authorization. */
    readonly authorization: string
}

/** The customer of award till points, as a named part. */
export interface AwardTillPointsCustomerResult {
    /** The customer id. */
    readonly customerId: string
    /** The name. */
    readonly name: string
    /** The phone. */
    readonly phone: string | null
    /** The email. */
    readonly email: string | null
    /** The tier. */
    readonly tier: string | null
    /** The points. */
    readonly points: number
    /** The lifetime spend vnd. */
    readonly lifetimeSpendVnd: number
    /** The visits. */
    readonly visits: number
    /** The last visit at. */
    readonly lastVisitAt: string | null
}

/** What award-till-points answers. */
export interface AwardTillPointsResult {
    /** The status. */
    readonly status: "done" | "duplicate" | "no_points"
    /** The customer. */
    readonly customer: AwardTillPointsCustomerResult
}
