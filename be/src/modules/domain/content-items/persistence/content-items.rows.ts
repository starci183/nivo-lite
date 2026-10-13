/** One post as `SELECT_ITEMS_BETWEEN` reads it. */
export interface ItemRow {
    /** The post. */
    readonly id: string
    /** Its title. */
    readonly title: string
    /** Its status. */
    readonly status: string
    /** The channels it goes to. */
    readonly channels: ReadonlyArray<string>
    /** When it is due, as an ISO instant. */
    readonly scheduled_at: string | null
    /** Its content theme. */
    readonly pillar_id: string | null
}

/** A post an offer already made. */
export interface OfferItemRow {
    /** The post. */
    readonly id: string
    /** Its status. */
    readonly status: string
}

/** The answer of an insert that returns the new id. */
export interface InsertedRow {
    /** The new row. */
    readonly id: string
}
