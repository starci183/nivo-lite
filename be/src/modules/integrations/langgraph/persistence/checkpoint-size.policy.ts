/** The limits of the checkpoint saver: bytes of one stored value (a checkpoint, a channel value, a pending write) and rows of one list. */
export interface CheckpointLimits {
    /** From this size on a value is logged as large; it is still stored. */
    readonly warnBytes: number
    /** Above this size a value is refused and nothing is written. */
    readonly maxBytes: number
    /** The most checkpoints one `list` answers. */
    readonly listMax: number
}

/**
 * The limits when the app sets none. A thread's state holds ids and step outputs, never a conversation or a prompt, so a value of
 * a quarter of a megabyte already says a node put something in the state that belongs behind a tool; four megabytes is refused so
 * one run cannot fill the table.
 */
export const DEFAULT_CHECKPOINT_LIMITS: CheckpointLimits = {
    warnBytes: 256 * 1024,
    maxBytes: 4 * 1024 * 1024,
    listMax: 1000,
}

/** How a value's size reads against the limits. */
export type CheckpointSize = "fine" | "large" | "refused"

/**
 * Reads a size against the limits.
 *
 * @param bytes - The serialised size.
 * @param limits - The limits in force.
 * @returns `refused` above the maximum, `large` from the warning size on, else `fine`.
 */
export const sizeOf = (bytes: number, limits: CheckpointLimits): CheckpointSize => {
    if (bytes > limits.maxBytes) return "refused"
    return bytes >= limits.warnBytes ? "large" : "fine"
}

/**
 * The bound of one `list`.
 *
 * @param asked - The limit the caller asked, or undefined.
 * @param limits - The limits in force.
 * @returns The asked limit when it is a whole number from 0 to the maximum, else the maximum.
 */
export const listLimitOf = (asked: number | undefined, limits: CheckpointLimits): number =>
    asked !== undefined && Number.isInteger(asked) && asked >= 0 && asked <= limits.listMax ? asked : limits.listMax
