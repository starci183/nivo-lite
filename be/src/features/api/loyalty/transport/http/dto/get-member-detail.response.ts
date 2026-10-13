/** The member of get member detail, as a named part. */
export class GetMemberDetailMemberResponse {
    /** The id. */
    id!: string

    /** The name. */
    name!: string

    /** The phone. */
    phone!: string | null

    /** The email. */
    email!: string | null

    /** The birthday. */
    birthday!: string | null

    /** The tier key. */
    tierKey!: string | null

    /** The points. */
    points!: number

    /** The lifetime spend vnd. */
    lifetimeSpendVnd!: number

    /** The visits. */
    visits!: number

    /** The last visit at. */
    lastVisitAt!: string | null

    /** The joined at. */
    joinedAt!: string

    /** The note. */
    note!: string
}

/** The ledger of get member detail, as a named part. */
export class GetMemberDetailLedgerResponse {
    /** The id. */
    id!: string

    /** The customer id. */
    customerId!: string

    /** The kind. */
    kind!: "earn" | "redeem" | "expire" | "adjust"

    /** The points. */
    points!: number

    /** The amount vnd. */
    amountVnd!: number | null

    /** The order id. */
    orderId!: string | null

    /** The ref. */
    ref!: string

    /** The by. */
    by!: string

    /** The evidence. */
    evidence!: string | null

    /** The reward id. */
    rewardId!: string | null

    /** The work item id. */
    workItemId!: string | null

    /** The expires at. */
    expiresAt!: string | null

    /** The occurred at. */
    occurredAt!: string
}

/** The tier of get member detail next tier, as a named part. */
export class GetMemberDetailNextTierTierResponse {
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

/** The next tier of get member detail, as a named part. */
export class GetMemberDetailNextTierResponse {
    /** The tier. */
    tier!: GetMemberDetailNextTierTierResponse

    /** The missing vnd. */
    missingVnd!: number
}

/** The expiring of get member detail, as a named part. */
export class GetMemberDetailExpiringResponse {
    /** The points. */
    points!: number

    /** The first at. */
    firstAt!: string | null
}

/** The reward of get member detail rewards, as a named part. */
export class GetMemberDetailRewardsRewardResponse {
    /** The id. */
    id!: string

    /** The key. */
    key!: string

    /** The name. */
    name!: string

    /** The kind. */
    kind!: "voucher" | "item" | "percent"

    /** The value vnd. */
    valueVnd!: number

    /** The percent. */
    percent!: number | null

    /** The points cost. */
    pointsCost!: number

    /** The stock. */
    stock!: number | null

    /** The per customer limit. */
    perCustomerLimit!: number | null

    /** The min tier key. */
    minTierKey!: string | null

    /** The note. */
    note!: string

    /** The active. */
    active!: boolean
}

/** The block of get member detail rewards, as a named part. */
export class GetMemberDetailRewardsBlockResponse {
    /** The code. */
    code!: "inactive" | "out_of_stock" | "not_enough_points" | "limit_reached" | "tier_required"

    /** The params. */
    params!: Readonly<Record<string, string | number>>
}

/** The rewards of get member detail, as a named part. */
export class GetMemberDetailRewardsResponse {
    /** The reward. */
    reward!: GetMemberDetailRewardsRewardResponse

    /** The block. */
    block!: GetMemberDetailRewardsBlockResponse | null
}

/** The HTTP answer of get-member-detail. */
export class GetMemberDetailResponse {
    /** The member. */
    member!: GetMemberDetailMemberResponse

    /** The ledger. */
    ledger!: ReadonlyArray<GetMemberDetailLedgerResponse>

    /** The tier name. */
    tierName!: string

    /** The next tier. */
    nextTier!: GetMemberDetailNextTierResponse | null

    /** The expiring. */
    expiring!: GetMemberDetailExpiringResponse

    /** The rewards. */
    rewards!: ReadonlyArray<GetMemberDetailRewardsResponse>
}
