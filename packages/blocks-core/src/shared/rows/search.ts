/** How long the list pane waits after the last keystroke before it writes the search param. */
export const SEARCH_DEBOUNCE_MS = 300

/** The longest search a person can write to the URL; a longer paste is cut. */
export const SEARCH_MAX = 200

/** What the search param holds for the text typed: trimmed and cut, with nothing typed meaning no param. */
export const queryOf = (text: string | null): string | null => {
    const trimmed = (text ?? "").trim().slice(0, SEARCH_MAX).trim()
    return trimmed === "" ? null : trimmed
}

/**
 * What to write to the search param for the text typed, or null when the param already says it.
 * The wrapper object tells "write nothing" (null) from "clear the param" (`{ value: null }`).
 */
export const pendingQuery = (typed: string, current: string | null): { readonly value: string | null } | null => {
    const next = queryOf(typed)
    return next === queryOf(current) ? null : { value: next }
}
