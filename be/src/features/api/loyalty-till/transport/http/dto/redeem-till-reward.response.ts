/** The reward of redeem till reward, as a named part. */
export class RedeemTillRewardRewardResponse {
    /** The key. */
    key!: string

    /** The name. */
    name!: string

    /** The value_vnd. */
    value_vnd!: number

    /** The points_cost. */
    points_cost!: number
}

/** The customer of redeem till reward, as a named part. */
export class RedeemTillRewardCustomerResponse {
    /** The customer_id. */
    customer_id!: string

    /** The name. */
    name!: string

    /** The phone. */
    phone!: string | null

    /** The email. */
    email!: string | null

    /** The tier. */
    tier!: string | null

    /** The points. */
    points!: number

    /** The lifetime_spend_vnd. */
    lifetime_spend_vnd!: number

    /** The visits. */
    visits!: number

    /** The last_visit_at. */
    last_visit_at!: string | null
}

/** The HTTP answer of redeem-till-reward. */
export class RedeemTillRewardResponse {
    /** The status. */
    status!: "done" | "duplicate"

    /** The code. */
    code!: string

    /** The reward. */
    reward!: RedeemTillRewardRewardResponse

    /** The customer. */
    customer!: RedeemTillRewardCustomerResponse
}
