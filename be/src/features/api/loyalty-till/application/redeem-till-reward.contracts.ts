/** What redeem-till-reward takes. */
export interface RedeemTillRewardRequest {
    /** The phone. */
    readonly phone: string
    /** The customer id. */
    readonly customerId: string
    /** The reward key. */
    readonly rewardKey: string
    /** The ref. */
    readonly ref: string
    /** The authorization. */
    readonly authorization: string
}

/** The reward of redeem till reward, as a named part. */
export interface RedeemTillRewardRewardResult {
    /** The key. */
    readonly key: string
    /** The name. */
    readonly name: string
    /** The value vnd. */
    readonly valueVnd: number
    /** The points cost. */
    readonly pointsCost: number
}

/** The customer of redeem till reward, as a named part. */
export interface RedeemTillRewardCustomerResult {
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

/** What redeem-till-reward answers. */
export interface RedeemTillRewardResult {
    /** The status. */
    readonly status: "done" | "duplicate"
    /** The code. */
    readonly code: string
    /** The reward. */
    readonly reward: RedeemTillRewardRewardResult
    /** The customer. */
    readonly customer: RedeemTillRewardCustomerResult
}
