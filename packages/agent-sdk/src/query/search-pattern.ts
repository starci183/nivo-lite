import { QUERY_BOUNDS } from "./query-bounds"

/** Escapes `\`, `%` and `_`, so user text matches itself inside a LIKE operand (the default LIKE escape is the backslash). */
export const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (char) => `\\${char}`)

/**
 * The LIKE operand of a `search` filter: the text trimmed, cut to the search bound, escaped and wrapped in `%`. Null when nothing is
 * left to search for. The compiler folds both sides with `public.knowledge_fold`, so accents and case never matter.
 */
export const searchOperand = (text: string): string | null => {
    const trimmed = text.trim().slice(0, QUERY_BOUNDS.searchText)
    return trimmed === "" ? null : `%${escapeLike(trimmed)}%`
}
