/**
 * A LOCAL MIRROR of the list types wave 1 owns (packages/agent-sdk/src/block/list.types.ts, A1 commit 3ac329e65, brief
 * D:/starci-tmp/claude-20261105/lanes/blocks-src/A1-SDK.md Part 2 step 4). It is the only place this directory restates them: when
 * the merge phase lands wave 1, this file is replaced by an import of `../block/list.types` and deleted (plan risk R-f).
 */

/** How a filter case compares a field. */
export type FilterOp = "eq" | "in" | "lt" | "lte" | "gt" | "gte"

/** One named comparison of a filter: a field against a value, or against another field of the same row (`ref`). */
export interface FilterCase {
    /** The row field the case compares. */
    readonly field: string
    /** The comparison. */
    readonly op: FilterOp
    /** The literal the field is compared with; absent when `ref` names a field. */
    readonly value?: string | number | boolean | null
    /** The field of the same row the field is compared with (`quantity <= reorderPoint`). */
    readonly ref?: string
}

/** A filter of a list: data the provider turns into a condition, never a clause a module writes. */
export type ListFilter =
    | {
          /** The row field the filter compares. */
          readonly field: string
          /** `eq`: the field equals the chosen value; `in`: the field is among the chosen values. */
          readonly op: "eq" | "in"
          /** The values the filter takes. */
          readonly of: ReadonlyArray<string>
      }
    | {
          /** Named cases, each a comparison; the chosen case name selects one (stock `low` / `out`). */
          readonly cases: Readonly<Record<string, FilterCase>>
      }

/** The fields a list searches. */
export interface ListSearch {
    /** The row fields searched; the provider applies an accent-insensitive, case-insensitive substring match to them. */
    readonly fields: ReadonlyArray<string>
}

/** Keyset paging of a list. */
export interface ListPaging {
    /** The rows of a page. */
    readonly size: number
}

/** Which fields of a row a list draws. */
export interface ListRow {
    /** The field that identifies the row. */
    readonly id: string
    /** The field drawn as the title. */
    readonly title: string
    /** The field drawn as the description, when any. */
    readonly description?: string
    /** The field drawn as the badge, when any. */
    readonly badge?: string
}

/** What a list read accepts and returns: the provider turns it, with a `ListQuery`, into one query. */
export interface ListShape {
    /** The fields searched; absent for a list without search. */
    readonly search?: ListSearch
    /** The filters by name; each becomes an optional variable that takes its values or `"all"`. */
    readonly filters?: Readonly<Record<string, ListFilter>>
    /** The orders by name, each a list of `[field, direction]`; the first key is the default. */
    readonly sort: Readonly<Record<string, ReadonlyArray<readonly [string, "asc" | "desc"]>>>
    /** Keyset paging: `size` rows a page; the cursor is opaque. */
    readonly page: ListPaging
    /** Which fields of a row a list draws as its id, title, description and badge. */
    readonly row: ListRow
}

/** One request to a list source, parsed from the variables of a list read. */
export interface ListQuery {
    /** The search text, trimmed; null for no search. */
    readonly q: string | null
    /** The chosen value of each filter that is not `"all"`, by filter name. */
    readonly filters: Readonly<Record<string, string>>
    /** The chosen sort key. */
    readonly sort: string
    /** The opaque cursor of the page to load; null for the first. */
    readonly cursor: string | null
    /** The page size. */
    readonly size: number
}
