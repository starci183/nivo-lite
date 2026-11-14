/** The provider mark keeps the glyph box the grammar icon gives every other source. */
export const GOOGLE_MARK = "size-5"

/** The text colour the outline of each run state takes. */
export const RUN_MARK_COLOURS = {
    queued: "text-muted",
    scheduled: "text-muted",
    waiting: "text-warning",
    done: "text-success",
    failed: "text-danger",
    pending: "text-muted",
    cancelled: "text-muted",
} as const
