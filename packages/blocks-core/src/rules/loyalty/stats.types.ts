/** How many members hold one tier. */
export interface TierCount {
    /** The key of the tier. */
    readonly key: string
    /** The name of the tier. */
    readonly name: string
    /** The members holding it. */
    readonly count: number
}

/** The statistics of the workbench: the members and what the ledger moved in the last 30 days. */
export interface LoyaltyStats {
    /** All members. */
    readonly members: number
    /** Members who bought in the last 90 days. */
    readonly active90d: number
    /** The points all members hold. */
    readonly pointsOutstanding: number
    /** The points earned in 30 days. */
    readonly earned30d: number
    /** The points redeemed in 30 days. */
    readonly redeemed30d: number
    /** The points that expired in 30 days. */
    readonly expired30d: number
    /** The redemptions in 30 days. */
    readonly redemptions30d: number
    /** The spend that earned points in 30 days, in VND. */
    readonly spend30d: number
    /** The cash value of the rewards redeemed in 30 days, in VND. */
    readonly rewardValue30d: number
    /** The promotions sent in 30 days. */
    readonly promosSent30d: number
    /** The members whose birthday is this month. */
    readonly birthdaysThisMonth: number
    /** The members of each tier. */
    readonly tierCounts: ReadonlyArray<TierCount>
}

/** The ribbon of the workbench: the same numbers as the tabs, so the two never disagree. */
export interface LoyaltyFigures {
    /** All members. */
    readonly members: number
    /** Members who bought in the last 60 days. */
    readonly activeMembers: number
    /** The points issued in 30 days. */
    readonly pointsIssued30d: number
    /** The redemptions in 30 days. */
    readonly redemptions30d: number
    /** The points redeemed in 30 days. */
    readonly pointsRedeemed30d: number
    /** The members with no activity for 60 days. */
    readonly atRisk: number
}

/** How lively a member is: bought lately, quiet for a long time, or too new to tell. */
export type MemberActivity = "active" | "at_risk" | "new"
