/** What get-member-detail takes. */
export interface GetMemberDetailRequest {
    /** The workspace id. */
    readonly workspaceId: string
    /** The customer id. */
    readonly customerId: string
}

/** The member of get member detail, as a named part. */
export interface GetMemberDetailMemberResult {
    /** The id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The phone. */
    readonly phone: string | null
    /** The email. */
    readonly email: string | null
    /** The birthday. */
    readonly birthday: string | null
    /** The tier key. */
    readonly tierKey: string | null
    /** The points. */
    readonly points: number
    /** The lifetime spend vnd. */
    readonly lifetimeSpendVnd: number
    /** The visits. */
    readonly visits: number
    /** The last visit at. */
    readonly lastVisitAt: string | null
    /** The joined at. */
    readonly joinedAt: string
    /** The note. */
    readonly note: string
}

/** The ledger of get member detail, as a named part. */
export interface GetMemberDetailLedgerResult {
    /** The id. */
    readonly id: string
    /** The customer id. */
    readonly customerId: string
    /** The kind. */
    readonly kind: "earn" | "redeem" | "expire" | "adjust"
    /** The points. */
    readonly points: number
    /** The amount vnd. */
    readonly amountVnd: number | null
    /** The order id. */
    readonly orderId: string | null
    /** The ref. */
    readonly ref: string
    /** The by. */
    readonly by: string
    /** The evidence. */
    readonly evidence: string | null
    /** The reward id. */
    readonly rewardId: string | null
    /** The work item id. */
    readonly workItemId: string | null
    /** The expires at. */
    readonly expiresAt: string | null
    /** The occurred at. */
    readonly occurredAt: string
}

/** The tier of get member detail next tier, as a named part. */
export interface GetMemberDetailNextTierTierResult {
    /** The key. */
    readonly key: string
    /** The name. */
    readonly name: string
    /** The min spend vnd. */
    readonly minSpendVnd: number
    /** The multiplier. */
    readonly multiplier: number
    /** The winback days. */
    readonly winbackDays: number
    /** The benefit. */
    readonly benefit: string
}

/** The next tier of get member detail, as a named part. */
export interface GetMemberDetailNextTierResult {
    /** The tier. */
    readonly tier: GetMemberDetailNextTierTierResult
    /** The missing vnd. */
    readonly missingVnd: number
}

/** The expiring of get member detail, as a named part. */
export interface GetMemberDetailExpiringResult {
    /** The points. */
    readonly points: number
    /** The first at. */
    readonly firstAt: string | null
}

/** The reward of get member detail rewards, as a named part. */
export interface GetMemberDetailRewardsRewardResult {
    /** The id. */
    readonly id: string
    /** The key. */
    readonly key: string
    /** The name. */
    readonly name: string
    /** The kind. */
    readonly kind: "voucher" | "item" | "percent"
    /** The value vnd. */
    readonly valueVnd: number
    /** The percent. */
    readonly percent: number | null
    /** The points cost. */
    readonly pointsCost: number
    /** The stock. */
    readonly stock: number | null
    /** The per customer limit. */
    readonly perCustomerLimit: number | null
    /** The min tier key. */
    readonly minTierKey: string | null
    /** The note. */
    readonly note: string
    /** The active. */
    readonly active: boolean
}

/** The block of get member detail rewards, as a named part. */
export interface GetMemberDetailRewardsBlockResult {
    /** The code. */
    readonly code: "inactive" | "out_of_stock" | "not_enough_points" | "limit_reached" | "tier_required"
    /** The params. */
    readonly params: Readonly<Record<string, string | number>>
}

/** The rewards of get member detail, as a named part. */
export interface GetMemberDetailRewardsResult {
    /** The reward. */
    readonly reward: GetMemberDetailRewardsRewardResult
    /** The block. */
    readonly block: GetMemberDetailRewardsBlockResult | null
}

/** What get-member-detail answers. */
export interface GetMemberDetailResult {
    /** The member. */
    readonly member: GetMemberDetailMemberResult
    /** The ledger. */
    readonly ledger: ReadonlyArray<GetMemberDetailLedgerResult>
    /** The tier name. */
    readonly tierName: string
    /** The next tier. */
    readonly nextTier: GetMemberDetailNextTierResult | null
    /** The expiring. */
    readonly expiring: GetMemberDetailExpiringResult
    /** The rewards. */
    readonly rewards: ReadonlyArray<GetMemberDetailRewardsResult>
}
