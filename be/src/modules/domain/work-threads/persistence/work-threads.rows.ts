/** One thread as the queries select it. */
export interface ThreadRow {
    /** The thread id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The title. */
    readonly title: string
    /** The lead, or null. */
    readonly lead_id: string | null
    /** The order, or null. */
    readonly order_id: string | null
    /** The status. */
    readonly status: string
    /** The member id of whoever opened it. */
    readonly created_by: string
    /** Creation instant as database text. */
    readonly created_at: string
    /** Last change instant as database text. */
    readonly updated_at: string
}

/** A lead or order id the workspace owns. */
export interface OwnedIdRow {
    /** The id. */
    readonly id: string
}
