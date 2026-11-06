import type { PortDefinition } from "../port/port.types"

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
          /**
           * With `open`, the filter takes any value up to the key bound, and `of` only lists the values that are known when the
           * module is written (a ladder of tiers the owner renames). The module judges the value it is given, and its counts
           * name the values the rows hold.
           */
          readonly open?: boolean
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

/** One page of a list. */
export interface ListPage<T> {
    /** The rows of the page, in the order of the chosen sort. */
    readonly rows: ReadonlyArray<T>
    /** The cursor of the next page; null when there is none. */
    readonly cursor: string | null
}

/** The one generic port a list read runs on: the provider turns a `ListShape` and a `ListQuery` into queries. */
export interface ListSource<T> {
    /** One page of rows for the query. */
    readonly page: (shape: ListShape, query: ListQuery) => Promise<ListPage<T>>
    /** The number of rows for each value of the filter `by`, under the query's search and every other filter. */
    readonly counts: (shape: ListShape, by: string, query: ListQuery) => Promise<Readonly<Record<string, number>>>
}

/** What a list read keeps of its declaration, so a counts read and a spec can follow it. */
export interface ListListing {
    /** Marks the read as a list read. */
    readonly kind: "list"
    /** The declared shape. */
    readonly shape: ListShape
    /** The sort key used when a query names none: the first key of `shape.sort`. */
    readonly defaultSort: string
    /** The port the list runs on. */
    readonly source: PortDefinition<ListSource<unknown>>
}

/** What a counts read keeps of its declaration. */
export interface CountsListing {
    /** Marks the read as a counts read. */
    readonly kind: "counts"
    /** The id of the list read it counts. */
    readonly of: `${string}.${string}`
    /** The filter of that list whose values are counted. */
    readonly by: string
}

/** What a list or counts read says about itself. */
export type ReadListing = ListListing | CountsListing

/** What a counts read yields: the number of rows per value of the counted filter, and their sum. */
export interface CountsResult {
    /** Rows per value of the filter. */
    readonly counts: Readonly<Record<string, number>>
    /** The sum of `counts`. */
    readonly total: number
}
