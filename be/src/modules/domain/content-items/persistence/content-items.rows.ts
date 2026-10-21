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

/** One stored channel draft. */
export interface AgentDraftVariantRow {
    /** The post text. */
    readonly text: string
    /** The hashtags. */
    readonly hashtags: ReadonlyArray<string>
    /** The channel note. */
    readonly note: string
}

/** A stored agent draft. */
export interface AgentDraftRow {
    /** The id. */
    readonly id: string
    /** The stored variants. */
    readonly variants: Readonly<Record<string, AgentDraftVariantRow>>
    /** The stored channels. */
    readonly channels: ReadonlyArray<string>
}

/** One stored channel text. */
export interface VariantTextRow {
    /** The text, when written. */
    readonly text?: string
}

/** One stored attachment. */
export interface MediaPathRow {
    /** The storage path, when present. */
    readonly path?: string
}

/** A post as the scheduler reads it. */
export interface ScheduleItemRow {
    /** The id. */
    readonly id: string
    /** The title. */
    readonly title: string
    /** The channels. */
    readonly channels: ReadonlyArray<string>
    /** The variants. */
    readonly variants: Readonly<Record<string, VariantTextRow>>
    /** The attachments. */
    readonly media: ReadonlyArray<MediaPathRow>
    /** When it should be published. */
    readonly scheduled_at: string | null
}

/** A post that is due on a channel, as the scheduler tick reads it. */
export interface DueChannelPostRow extends ScheduleItemRow {
    /** The workspace. */
    readonly workspace_id: string
    /** The channel's reference of the scheduled post. */
    readonly ref: string
}
