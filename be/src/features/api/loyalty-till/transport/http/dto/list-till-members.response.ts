/** The members of list till members, as a named part. */
export class ListTillMembersMembersResponse {
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

/** The HTTP answer of list-till-members. */
export class ListTillMembersResponse {
    /** The members. */
    members!: ReadonlyArray<ListTillMembersMembersResponse>
}
