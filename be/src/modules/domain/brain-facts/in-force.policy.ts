/**
 * What a workspace holds IN FORCE: its truths that are `active` or `scheduled` (a value that waits for its start will be in force) and
 * the bytes of their text (subject, attribute, value and unit in UTF-8). The one count a bound on the truths in force is checked
 * against, read inside the write that is bounded.
 */
export interface InForceHeld {
    /** How many truths. */
    readonly truths: number
    /** Their text in bytes. */
    readonly bytes: number
}

/** The most a workspace may hold in force after a BOUNDED write (the caller's ceiling; this store knows no number of its own). */
export interface InForceBound {
    /** The most truths in force. */
    readonly truths: number
    /** The most bytes of truth text in force. */
    readonly bytes: number
}

/** The count of the truths in force as the database answers it (numbers as text). */
export interface InForceCount {
    /** How many truths. */
    readonly truths: string
    /** Their text in bytes. */
    readonly bytes: string
}

/** The statuses that count as in force. */
export const IN_FORCE_STATUSES = ["active", "scheduled"] as const

/** The bytes of the truths in force, summed in the database. */
export const IN_FORCE_BYTES =
    "COALESCE(SUM(octet_length(f.subjectLabel) + octet_length(f.attributeLabel) + octet_length(f.value) + COALESCE(octet_length(f.unit), 0)), 0)"

/**
 * The key of the advisory lock every BOUNDED write of a workspace takes first: bounded writes of one workspace run one after the
 * other, so the count each one reads is the count its own write lands on (D-U-1: six settles each read "room" and all applied).
 */
export const inForceLockKey = (workspaceId: string): string => `brain-facts.in-force:${workspaceId}`

/**
 * Whether a write took the workspace over its bound: it ADDED to what is in force (a truth more, or more bytes) and what is in force
 * after it is above the bound. A write that adds nothing (the next version of a value in force replaces it) is never refused, whatever
 * the workspace already holds: the founder's own writes are not bounded and may have taken it above.
 */
export const addsOverBound = (before: InForceHeld, after: InForceHeld, bound: InForceBound): boolean =>
    (after.truths > before.truths && after.truths > bound.truths) || (after.bytes > before.bytes && after.bytes > bound.bytes)
