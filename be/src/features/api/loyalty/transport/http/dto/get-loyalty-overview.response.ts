/** The tier counts of get loyalty overview stats, as a named part. */
export class GetLoyaltyOverviewStatsTierCountsResponse {
    /** The key. */
    key!: string

    /** The name. */
    name!: string

    /** The count. */
    count!: number
}

/** The stats of get loyalty overview, as a named part. */
export class GetLoyaltyOverviewStatsResponse {
    /** The members. */
    members!: number

    /** The active90d. */
    active90d!: number

    /** The points outstanding. */
    pointsOutstanding!: number

    /** The earned30d. */
    earned30d!: number

    /** The redeemed30d. */
    redeemed30d!: number

    /** The expired30d. */
    expired30d!: number

    /** The redemptions30d. */
    redemptions30d!: number

    /** The spend30d. */
    spend30d!: number

    /** The reward value30d. */
    rewardValue30d!: number

    /** The promos sent30d. */
    promosSent30d!: number

    /** The birthdays this month. */
    birthdaysThisMonth!: number

    /** The tier counts. */
    tierCounts!: ReadonlyArray<GetLoyaltyOverviewStatsTierCountsResponse>
}

/** The figures of get loyalty overview, as a named part. */
export class GetLoyaltyOverviewFiguresResponse {
    /** The members. */
    members!: number

    /** The active members. */
    activeMembers!: number

    /** The points issued30d. */
    pointsIssued30d!: number

    /** The redemptions30d. */
    redemptions30d!: number

    /** The points redeemed30d. */
    pointsRedeemed30d!: number

    /** The at risk. */
    atRisk!: number
}

/** The HTTP answer of get-loyalty-overview. */
export class GetLoyaltyOverviewResponse {
    /** The stats. */
    stats!: GetLoyaltyOverviewStatsResponse

    /** The figures. */
    figures!: GetLoyaltyOverviewFiguresResponse

    /** The now iso. */
    nowIso!: string
}
