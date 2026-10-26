/** One row of `realtime_events`, as the database answers it (`seq` is a bigint, which the driver returns as text). */
export interface EventRow {
    /** The global sequence number of the row: the order of publication and the key a notification names. */
    readonly seq: string
    /** The topic the frame was published to. */
    readonly topic: string
    /** The frame, as the database returns the jsonb value. */
    readonly payload: object
}

/** The answer of the highest sequence number query. */
export interface HighestSeqRow {
    /** The highest `seq` of the table, 0 for an empty table. */
    readonly seq: string
}

/** The answer of the retention delete: how many frames one pass removed (a count is a bigint, which the driver returns as text). */
export interface DeletedCountRow {
    /** The number of rows the pass deleted. */
    readonly deleted: string
}
