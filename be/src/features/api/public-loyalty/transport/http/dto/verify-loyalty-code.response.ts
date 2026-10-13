/** The tier of verify loyalty code points next tier, as a named part. */
export class VerifyLoyaltyCodePointsNextTierTierResponse {
    /** The key. */
    key!: string

    /** The name. */
    name!: string

    /** The min spend vnd. */
    minSpendVnd!: number

    /** The multiplier. */
    multiplier!: number

    /** The winback days. */
    winbackDays!: number

    /** The benefit. */
    benefit!: string
}

/** The next tier of verify loyalty code points, as a named part. */
export class VerifyLoyaltyCodePointsNextTierResponse {
    /** The tier. */
    tier!: VerifyLoyaltyCodePointsNextTierTierResponse

    /** The missing vnd. */
    missingVnd!: number
}

/** The expiring of verify loyalty code points, as a named part. */
export class VerifyLoyaltyCodePointsExpiringResponse {
    /** The points. */
    points!: number

    /** The first at. */
    firstAt!: string | null
}

/** The rewards of verify loyalty code points, as a named part. */
export class VerifyLoyaltyCodePointsRewardsResponse {
    /** The name. */
    name!: string

    /** The points cost. */
    pointsCost!: number

    /** The note. */
    note!: string

    /** The can redeem. */
    canRedeem!: boolean
}

/** The points of verify loyalty code, as a named part. */
export class VerifyLoyaltyCodePointsResponse {
    /** The shop. */
    shop!: string

    /** The name. */
    name!: string

    /** The tier name. */
    tierName!: string

    /** The points. */
    points!: number

    /** The next tier. */
    nextTier!: VerifyLoyaltyCodePointsNextTierResponse | null

    /** The expiring. */
    expiring!: VerifyLoyaltyCodePointsExpiringResponse

    /** The rewards. */
    rewards!: ReadonlyArray<VerifyLoyaltyCodePointsRewardsResponse>
}

/** The HTTP answer of verify-loyalty-code. */
export class VerifyLoyaltyCodeResponse {
    /** The ok. */
    ok!: boolean

    /** The code. */
    code!: "none" | "bad_phone" | "closed" | "busy" | "wrong"

    /** The points. */
    points!: VerifyLoyaltyCodePointsResponse | null
}
