import { z } from "zod"
import { defineRead } from "../block/block"
import { SdkDefinitionError } from "../block/definition-error"
import type { CountsResult, ListFilter, ListPage, ListQuery, ListShape, TimeWindow } from "../block/list.types"
import { isTimeToken, timeWindowOf } from "../block/time-token"
import { KEY_MAX } from "../schema/bounds"
import type { CountsReadConfig, ListReadConfig, ListReadDefinition } from "./declaration-list.types"
import type { ReadDefinition } from "../block/block.types"

/** The longest search text a list read accepts. */
const LIST_SEARCH_MAX = 200

/** The variable names a list read derives itself; a filter or an extra variable may not take them. */
const DERIVED: ReadonlySet<string> = new Set(["q", "sort", "cursor"])

/** The variables a read hands `listQueryOf`: parsed by the read's zod object, so a member has the type its schema gives it. */
type ListVariables = Readonly<Record<string, unknown>>

/** The values a filter takes, not counting `"all"`. */
const valuesOf = (filter: ListFilter): ReadonlyArray<string> =>
    "cases" in filter ? Object.keys(filter.cases) : filter.of

/** Whether a filter is sound: it has values, and a `within` filter takes only time tokens. */
const isSoundFilter = (filter: ListFilter): boolean =>
    valuesOf(filter).length > 0 && ("cases" in filter || filter.op !== "within" || filter.of.every(isTimeToken))

/** Whether a list shape can be turned into variables and a query: a positive page, sound filters, no clashing names. */
const isSound = (list: ListShape, extra: ReadonlyArray<string>): boolean => {
    const filters = Object.entries(list.filters ?? {})
    const names = new Set(filters.map(([name]) => name))
    return !(
        !Number.isInteger(list.page.size) ||
        list.page.size < 1 ||
        filters.some(([name, filter]) => DERIVED.has(name) || !isSoundFilter(filter)) ||
        extra.some((name) => DERIVED.has(name) || names.has(name))
    )
}

/** The variables a list read takes: `q`, one optional enum per filter, `sort` and `cursor`. */
const derivedShape = (list: ListShape): z.ZodRawShape => ({
    q: z.string().max(LIST_SEARCH_MAX).optional(),
    sort: z.enum(Object.keys(list.sort)).optional(),
    cursor: z.string().max(KEY_MAX).optional(),
    ...Object.fromEntries(
        Object.entries(list.filters ?? {}).map(([name, filter]) => [
            name,
            "open" in filter && filter.open === true
                ? z.string().min(1).max(KEY_MAX).optional()
                : z.enum([...valuesOf(filter), "all"]).optional(),
        ]),
    ),
})

/**
 * The query a list source runs, from the parsed variables of a list read and the clock of the run. A chosen value that is a time
 * token becomes the window it names at `now` (`windows`); every other chosen value stays a `filters` entry.
 */
export const listQueryOf = (list: ListShape, defaultSort: string, variables: ListVariables, now: Date): ListQuery => {
    const q = typeof variables.q === "string" ? variables.q.trim() : ""
    const filters: Record<string, string> = {}
    const windows: Record<string, TimeWindow> = {}
    for (const name of Object.keys(list.filters ?? {})) {
        const value = variables[name]
        if (typeof value !== "string" || value === "all") continue
        if (isTimeToken(value)) windows[name] = timeWindowOf(value, now)
        else filters[name] = value
    }
    return {
        q: q === "" ? null : q,
        filters,
        ...(Object.keys(windows).length === 0 ? {} : { windows }),
        sort: typeof variables.sort === "string" ? variables.sort : defaultSort,
        cursor: typeof variables.cursor === "string" ? variables.cursor : null,
        size: list.page.size,
    }
}

/**
 * Defines a list read: the derived variables, a `run` that parses them into a `ListQuery` and asks the port for a page, and the
 * shape `list` at path `rows`. Throws `SdkDefinitionError` `LIST_SHAPE_INVALID` for a shape it cannot serve.
 */
export const listRead = <T>(config: ListReadConfig<T>): ListReadDefinition => {
    const extra = config.variables?.shape ?? {}
    const [defaultSort] = Object.keys(config.list.sort)
    if (defaultSort === undefined || !isSound(config.list, Object.keys(extra)))
        throw new SdkDefinitionError("LIST_SHAPE_INVALID", config.id)
    const read = defineRead({
        id: config.id,
        dataKind: config.dataKind,
        shape: "list",
        fields: config.fields,
        paths: { rows: "list" },
        variables: z.object({ ...extra, ...derivedShape(config.list) }),
        permission: config.permission,
        ports: { source: config.source },
        run: ({ source }, variables, context): Promise<ListPage<T>> =>
            source.page(config.list, listQueryOf(config.list, defaultSort, variables, context.now)),
    })
    return { ...read, listing: { kind: "list", shape: config.list, defaultSort, source: config.source } }
}

/**
 * Defines the counts read of a list read: the number of rows per value of the filter `by`, under the same search and every other
 * filter, never `by` itself, the sort or the cursor. It yields `{ counts, total }` with `total` the sum of the counts. Throws
 * `SdkDefinitionError` `COUNTS_BY_UNKNOWN` when `by` is not a filter of the list.
 */
export const countsRead = (config: CountsReadConfig): ReadDefinition => {
    const { listing } = config.of
    if (!Object.keys(listing.shape.filters ?? {}).includes(config.by))
        throw new SdkDefinitionError("COUNTS_BY_UNKNOWN", config.id)
    const kept = Object.entries(config.of.variables.shape).filter(
        ([name]) => !["sort", "cursor", config.by].includes(name),
    )
    const read = defineRead({
        id: config.id,
        dataKind: "counts",
        shape: "record",
        fields: ["counts", "total"],
        paths: { counts: "record" },
        variables: z.object(Object.fromEntries(kept)),
        permission: config.permission ?? config.of.permission,
        ports: { source: listing.source },
        run: async ({ source }, variables, context): Promise<CountsResult> => {
            const counts = await source.counts(
                listing.shape,
                config.by,
                listQueryOf(listing.shape, listing.defaultSort, variables, context.now),
            )
            return { counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) }
        },
    })
    return { ...read, listing: { kind: "counts", of: config.of.id, by: config.by } }
}
