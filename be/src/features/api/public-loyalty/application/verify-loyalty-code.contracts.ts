/** What verify-loyalty-code takes. */
export interface VerifyLoyaltyCodeRequest {
    /** The slug. */
    readonly slug: string
    /** The phone. */
    readonly phone: string
    /** The typed. */
    readonly typed: string
}

/** The tier of verify loyalty code points next tier, as a named part. */
export interface VerifyLoyaltyCodePointsNextTierTierResult {
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

/** The next tier of verify loyalty code points, as a named part. */
export interface VerifyLoyaltyCodePointsNextTierResult {
    /** The tier. */
    readonly tier: VerifyLoyaltyCodePointsNextTierTierResult
    /** The missing vnd. */
    readonly missingVnd: number
}

/** The expiring of verify loyalty code points, as a named part. */
export interface VerifyLoyaltyCodePointsExpiringResult {
    /** The points. */
    readonly points: number
    /** The first at. */
    readonly firstAt: string | null
}

/** The rewards of verify loyalty code points, as a named part. */
export interface VerifyLoyaltyCodePointsRewardsResult {
    /** The name. */
    readonly name: string
    /** The points cost. */
    readonly pointsCost: number
    /** The note. */
    readonly note: string
    /** The can redeem. */
    readonly canRedeem: boolean
}

/** The points of verify loyalty code, as a named part. */
export interface VerifyLoyaltyCodePointsResult {
    /** The shop. */
    readonly shop: string
    /** The name. */
    readonly name: string
    /** The tier name. */
    readonly tierName: string
    /** The points. */
    readonly points: number
    /** The next tier. */
    readonly nextTier: VerifyLoyaltyCodePointsNextTierResult | null
    /** The expiring. */
    readonly expiring: VerifyLoyaltyCodePointsExpiringResult
    /** The rewards. */
    readonly rewards: ReadonlyArray<VerifyLoyaltyCodePointsRewardsResult>
}

/** What verify-loyalty-code answers. */
export interface VerifyLoyaltyCodeResult {
    /** The ok. */
    readonly ok: boolean
    /** The code. */
    readonly code: "none" | "bad_phone" | "closed" | "busy" | "wrong"
    /** The points. */
    readonly points: VerifyLoyaltyCodePointsResult | null
}
