import type { OptionalWorkItemCursor } from "./decisions.contracts"

/** The biggest page of work items one call returns. */
export const WORK_ITEM_PAGE_MAX = 100

/** A requested page size forced into 1..100; a non-integer rounds down and a non-number becomes 1. */
export const clampPageSize = (requested: number): number =>
    Number.isFinite(requested) ? Math.min(WORK_ITEM_PAGE_MAX, Math.max(1, Math.floor(requested))) : 1

/** The rows of a page and the cursor of the next one: the query asks for one row more than the page to know there is one. */
export interface PageSplit<R> {
    /** The rows of this page. */
    readonly rows: ReadonlyArray<R>
    /** The cursor of the next page; null on the last one. */
    readonly next: OptionalWorkItemCursor
}

/** Splits the `size + 1` rows a keyset query returned into the page and its next cursor. */
export const splitPage = <R extends { readonly id: string; readonly cursor_at: string }>(
    fetched: ReadonlyArray<R>,
    size: number,
): PageSplit<R> => {
    const rows = fetched.slice(0, size)
    const last = rows[rows.length - 1]
    return {
        rows,
        next: fetched.length > size && last !== undefined ? { createdAt: last.cursor_at, id: last.id } : null,
    }
}
