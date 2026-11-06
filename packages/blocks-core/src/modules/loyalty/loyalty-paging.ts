import type {
    EngineResult,
    EntityApi,
    EntityQuery,
    MeasureValue,
    PageRow,
    RecordRow,
} from "@nivo-lite/agent-sdk/entity/port"
import type { StoreResult } from "./loyalty.types"

/** The rows of one page the paged reads ask for: the engine's largest. */
export const PAGE_SIZE = 100

/** The times a write that lost a race to another write reads the record again. */
export const RETRIES = 3

/** The most rewards a catalogue holds. */
export const REWARDS_MAX = 500

/** A number the engine answered for a measure: a count, or a sum that may travel as text; zero when the group is empty. */
export const numberOf = (value: MeasureValue | undefined): number => {
    const parsed = typeof value === "number" ? value : Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

/** A query whose pages the helpers cut: everything but the page. */
export type PagelessQuery = Omit<EntityQuery, "page">

/** The pages of a query from the one `after` names on, until `limit` rows are read or the pages end. */
const pagesFrom = async (
    api: EntityApi,
    query: PagelessQuery,
    limit: number,
    after: string | undefined,
    read: ReadonlyArray<PageRow>,
): Promise<ReadonlyArray<PageRow>> => {
    const size = Math.min(PAGE_SIZE, limit - read.length)
    const page = await api.list({ ...query, page: after === undefined ? { size } : { size, after } })
    const rows = [...read, ...page.rows]
    return page.next === null || rows.length >= limit ? rows : pagesFrom(api, query, limit, page.next, rows)
}

/** The rows of a query, at most `limit`, read page after page. */
export const rowsOf = (api: EntityApi, query: PagelessQuery, limit: number): Promise<ReadonlyArray<PageRow>> =>
    pagesFrom(api, query, limit, undefined, [])

/** The first row of a query; null when it has none. */
export const firstOf = async (api: EntityApi, query: PagelessQuery): Promise<RecordRow | null> => {
    const page = await api.list({ ...query, page: { size: 1 } })
    return page.rows[0]?.row ?? null
}

/** What a store answers to a write: the row as written, or why nothing was written. */
export const resultOf = <T>(written: EngineResult, read: (record: RecordRow) => T | null): StoreResult<T> => {
    if (!written.ok) return { ok: false, reason: written.reason === "missing" ? "missing" : "conflict" }
    const row = read(written.row)
    return row === null ? { ok: false, reason: "conflict" } : { ok: true, row }
}
