/** What list-till-members takes. */
export interface ListTillMembersRequest {
    /** The phone. */
    readonly phone?: string | undefined
    /** The limit. */
    readonly limit: number
    /** The authorization. */
    readonly authorization: string
}

/** The members of list till members, as a named part. */
export interface ListTillMembersMembersResult {
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

/** What list-till-members answers. */
export interface ListTillMembersResult {
    /** The members. */
    readonly members: ReadonlyArray<ListTillMembersMembersResult>
}
