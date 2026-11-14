/** The kinds of a memory entry that are the outcome of a step (a trigger or a facts entry is not work an agent did). */
export const STEP_ENTRY_KINDS: ReadonlyArray<string> = ["done", "failed", "passed_over"]

/** The word an until loop's round key starts with: the engine writes a round as `r<n>` (`<loop>[r2].<node>`). */
const ROUND_PREFIX = "r"

/** The canonical text of a whole number from 1 (no sign, no leading zero, no spaces): the only shape a round key takes. */
const POSITIVE_WHOLE = /^[1-9]\d{0,8}$/u

/**
 * The round a body step ran in, read back from the item key of its step path (the inverse of the engine's round key `r<n>`): the number,
 * or null for an item that is no round (a for-each element, or a step outside every loop). It parses the engine's own key format; it
 * never decides what a word means.
 */
export const roundOfItemKey = (itemKey: string | null): number | null => {
    if (itemKey === null || !itemKey.startsWith(ROUND_PREFIX)) return null
    const digits = itemKey.slice(ROUND_PREFIX.length)
    return POSITIVE_WHOLE.test(digits) ? Number(digits) : null
}
