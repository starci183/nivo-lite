/** What get-loyalty-overview takes. */
export interface GetLoyaltyOverviewRequest {
    /** The workspace id. */
    readonly workspaceId: string
}

/** The tier counts of get loyalty overview stats, as a named part. */
export interface GetLoyaltyOverviewStatsTierCountsResult {
    /** The key. */
    readonly key: string
    /** The name. */
    readonly name: string
    /** The count. */
    readonly count: number
}

/** The stats of get loyalty overview, as a named part. */
export interface GetLoyaltyOverviewStatsResult {
    /** The members. */
    readonly members: number
    /** The active90d. */
    readonly active90d: number
    /** The points outstanding. */
    readonly pointsOutstanding: number
    /** The earned30d. */
    readonly earned30d: number
    /** The redeemed30d. */
    readonly redeemed30d: number
    /** The expired30d. */
    readonly expired30d: number
    /** The redemptions30d. */
    readonly redemptions30d: number
    /** The spend30d. */
    readonly spend30d: number
    /** The reward value30d. */
    readonly rewardValue30d: number
    /** The promos sent30d. */
    readonly promosSent30d: number
    /** The birthdays this month. */
    readonly birthdaysThisMonth: number
    /** The tier counts. */
    readonly tierCounts: ReadonlyArray<GetLoyaltyOverviewStatsTierCountsResult>
}

/** The figures of get loyalty overview, as a named part. */
export interface GetLoyaltyOverviewFiguresResult {
    /** The members. */
    readonly members: number
    /** The active members. */
    readonly activeMembers: number
    /** The points issued30d. */
    readonly pointsIssued30d: number
    /** The redemptions30d. */
    readonly redemptions30d: number
    /** The points redeemed30d. */
    readonly pointsRedeemed30d: number
    /** The at risk. */
    readonly atRisk: number
}

/** What get-loyalty-overview answers. */
export interface GetLoyaltyOverviewResult {
    /** The stats. */
    readonly stats: GetLoyaltyOverviewStatsResult
    /** The figures. */
    readonly figures: GetLoyaltyOverviewFiguresResult
    /** The now iso. */
    readonly nowIso: string
}
