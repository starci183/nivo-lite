import { isRecord } from "./json-shape"

/** One page of a paged list read: its rows and the cursor of the next page, null at the last. */
export interface ListPageAnswer {
    readonly rows: ReadonlyArray<unknown>
    readonly cursor: string | null
}

/** The page a list read answered, or null when the answer is not `{ rows, cursor }`. */
export const pageOf = (answer: unknown): ListPageAnswer | null => {
    if (!isRecord(answer) || !Array.isArray(answer.rows)) return null
    return { rows: answer.rows, cursor: typeof answer.cursor === "string" ? answer.cursor : null }
}

/** The rows the pages loaded after the first add to it, and the cursor the last of them left. */
export interface MorePages {
    /** The first page they extend; pages of another first page are stale and ignored. */
    readonly base: unknown
    readonly rows: ReadonlyArray<unknown>
    readonly cursor: string | null
}

/** The data a list read shows: the first page with the rows of the pages after it, and the cursor to ask next. */
export const accumulated = (first: unknown, more: MorePages | null): unknown => {
    const page = pageOf(first)
    if (page === null || more === null || more.base !== first) return first
    return { rows: [...page.rows, ...more.rows], cursor: more.cursor }
}

/** The appended pages that belong to this first page; pages loaded after another first page are dropped. */
export const currentMore = (more: MorePages | null, first: unknown): MorePages | null =>
    more !== null && more.base === first ? more : null

/** The appended pages with one more page after them. */
export const withPage = (first: unknown, more: MorePages | null, next: ListPageAnswer): MorePages => ({
    base: first,
    rows: [...(more?.rows ?? []), ...next.rows],
    cursor: next.cursor,
})
