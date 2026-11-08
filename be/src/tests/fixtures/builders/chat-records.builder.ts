import { ChatRecordsError, ChatRecordsErrorCode } from "@modules/domain/chat-records"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import { queryProblems, type FilterExpr, type Query } from "@nivo-lite/agent-sdk/query"
import type { EngineResult, EntitiesApi, ListPage, PageRow, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"

/** The workspace of every fake record. */
export const CHAT_WORKSPACE = "11111111-1111-4111-8111-111111111111"

/** The fields of a fake record. */
type Values = Readonly<Record<string, JsonValue>>

/** A fake record: a record row whose fields are plain JSON. */
interface FakeRow extends RecordRow {
    /** The declared fields. */
    readonly data: Values
}

/** The in-memory handle over `chat.conversation` and `chat.message` the chat-records specs run on. */
export interface FakeChat {
    /** The handle the services receive; a spec may replace a method to make the engine answer otherwise. */
    readonly api: EntitiesApi
    /** Every record, by entity then id. */
    readonly rows: Map<string, Map<string, FakeRow>>
    /** The links written: `entity:id:relation` to the target id. */
    readonly links: Map<string, string>
    /** Makes the next writes of an entity answer `stale` this many times. */
    readonly staleFor: (entity: string, times: number) => void
    /** Makes the next insert of an entity answer `taken`, as if another writer stored this row first. */
    readonly takenOnce: (entity: string, row: Values) => void
}

/** What the fake handle works on. */
interface Store {
    readonly table: (entity: string) => Map<string, FakeRow>
    readonly created: (entity: string, values: Values) => FakeRow
    readonly staleNow: (entity: string) => boolean
    readonly taken: Map<string, Values>
    readonly links: Map<string, string>
}

/** The values the engine gives a field a write leaves out. */
const DEFAULTS: Readonly<Record<string, Values>> = {
    "chat.conversation": { status: "ai", waiting: false, unanswered: false, lastText: "", messageCount: 0, name: "" },
}

/** The declarations the queries are checked against: the same planner rules the engine applies. */
const CATALOG = new Map(FLOW_F_ENTITIES.map((entity) => [entity.name, entity]))

/** The fields each unique constraint of the fake store is declared on. */
const KEYS: Readonly<Record<string, ReadonlyArray<string>>> = {
    channel_external: ["channel", "connectionId", "externalId"],
}

const ID_PREFIX = "00000000-0000-4000-8000-"

const ID_DIGITS = 12

const sortKey = (value: JsonValue | undefined): string => (typeof value === "string" ? value : "")

/** The value a filter reads: the record id or a declared field, null when the record holds none. */
const valueOf = (row: FakeRow, field: string): JsonValue => (field === "id" ? row.id : (row.data[field] ?? null))

/** Whether two filter values are equal. */
const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right)

/** Whether a row satisfies a filter: the operators the chat services use. */
const matches = (row: FakeRow, expr: FilterExpr | undefined): boolean => {
    if (expr === undefined) return true
    if (expr.op === "and") return expr.of.every((part) => matches(row, part))
    if (expr.op === "or") return expr.of.some((part) => matches(row, part))
    if (expr.op === "isNull") return valueOf(row, expr.field) === null
    if (expr.op === "notNull") return valueOf(row, expr.field) !== null
    if (expr.op === "lt") {
        const value = valueOf(row, expr.field)
        return typeof value === "string" && value < sortKey(expr.value)
    }
    if (expr.op === "in") return expr.values.some((value) => same(value, valueOf(row, expr.field)))
    if (expr.op === "eq") return same(valueOf(row, expr.field), expr.value)
    if (expr.op === "ne") return !same(valueOf(row, expr.field), expr.value)
    return expr.op === "gt" && sortKey(valueOf(row, expr.field)) > sortKey(expr.value)
}

/** The rows a query selects, ordered and paged, with the links its joins name. */
const pageOf = (rows: ReadonlyArray<FakeRow>, query: Query, links: ReadonlyMap<string, string>): ListPage => {
    const [field, direction] = query.order[0] ?? ["id", "asc"]
    const sign = direction === "desc" ? -1 : 1
    const keyOf = (row: FakeRow): string => sortKey(valueOf(row, field))
    const sorted = rows
        .filter((row) => matches(row, query.where))
        .toSorted((left, right) => (keyOf(left).localeCompare(keyOf(right)) || left.id.localeCompare(right.id)) * sign)
    return {
        rows: sorted.slice(0, query.page.size).map((row): PageRow => ({
            row,
            joined: Object.fromEntries(
                Object.keys(query.join ?? {}).map((relation) => {
                    const target = links.get(`${query.from}:${row.id}:${relation}`)
                    return [relation, target === undefined ? null : { id: target, data: {} }]
                }),
            ),
            position: [],
            included: {},
        })),
        next: null,
    }
}

const okOf = (row: FakeRow, createdNow?: boolean): EngineResult =>
    createdNow === undefined
        ? { ok: true, row, version: row.version }
        : { ok: true, row, version: row.version, created: createdNow }

/** The handle over the store. */
const apiOver = (store: Store): EntitiesApi => ({
    get: (entity, id) => Promise.resolve(store.table(entity).get(id) ?? null),
    list: (query) => {
        const [problem] = queryProblems(query, CATALOG)
        if (problem !== undefined)
            return Promise.reject(
                new ChatRecordsError({
                    code: ChatRecordsErrorCode.NotStored,
                    params: { problem: problem.code, at: problem.at },
                }),
            )
        return Promise.resolve(pageOf([...store.table(query.from).values()], query, store.links))
    },
    aggregate: () => Promise.resolve([]),
    insert: (entity, values, linked) => {
        const other = store.taken.get(entity)
        if (other !== undefined) {
            store.taken.delete(entity)
            store.created(entity, other)
            return Promise.resolve({ ok: false, reason: "taken", constraint: "k", refusal: "r" })
        }
        const row = store.created(entity, values)
        Object.entries(linked ?? {}).forEach(([relation, to]) => store.links.set(`${entity}:${row.id}:${relation}`, to))
        return Promise.resolve(okOf(row, true))
    },
    update: (entity, key, expected, values) => {
        const row = store.table(entity).get(key)
        if (row === undefined) return Promise.resolve({ ok: false, reason: "missing" })
        if (row.version !== expected || store.staleNow(entity)) return Promise.resolve({ ok: false, reason: "stale" })
        const changed: FakeRow = { ...row, version: String(Number(row.version) + 1), data: { ...row.data, ...values } }
        store.table(entity).set(key, changed)
        return Promise.resolve(okOf(changed))
    },
    upsert: () => Promise.resolve({ ok: false, reason: "invalid" }),
    ensure: (entity, match, values) => {
        const fields = KEYS[match] ?? []
        const existing =
            fields.length === 0
                ? undefined
                : [...store.table(entity).values()].find((row) =>
                      fields.every((name) => row.data[name] === values[name]),
                  )
        return Promise.resolve(
            existing === undefined ? okOf(store.created(entity, values), true) : okOf(existing, false),
        )
    },
    delete: () => Promise.resolve({ ok: false, reason: "missing" }),
    link: (entity, key, relation, to) => {
        const row = store.table(entity).get(key)
        if (row === undefined) return Promise.resolve({ ok: false, reason: "missing" })
        store.links.set(`${entity}:${key}:${relation}`, to)
        return Promise.resolve(okOf(row))
    },
    unlink: () => Promise.resolve({ ok: false, reason: "missing" }),
})

/** A fresh in-memory chat store. */
export const fakeChat = (): FakeChat => {
    const rows = new Map<string, Map<string, FakeRow>>()
    const links = new Map<string, string>()
    const stale = new Map<string, number>()
    const taken = new Map<string, Values>()
    const table = (entity: string): Map<string, FakeRow> => {
        const found = rows.get(entity) ?? new Map<string, FakeRow>()
        rows.set(entity, found)
        return found
    }
    const created = (entity: string, values: Values): FakeRow => {
        const stored = [...rows.values()].reduce((sum, each) => sum + each.size, 0)
        const row: FakeRow = {
            id: `${ID_PREFIX}${String(stored + 1).padStart(ID_DIGITS, "0")}`,
            workspaceId: CHAT_WORKSPACE,
            version: "1",
            createdAt: "2026-11-06T00:00:00.000Z",
            updatedAt: "2026-11-06T00:00:00.000Z",
            data: { ...DEFAULTS[entity], ...values },
        }
        table(entity).set(row.id, row)
        return row
    }
    const staleNow = (entity: string): boolean => {
        const left = stale.get(entity) ?? 0
        stale.set(entity, Math.max(0, left - 1))
        return left > 0
    }
    return {
        api: apiOver({ table, created, staleNow, taken, links }),
        rows,
        links,
        staleFor: (entity, times) => stale.set(entity, times),
        takenOnce: (entity, row) => taken.set(entity, row),
    }
}

/** A stored conversation's fields, with the defaults a new record holds. */
export const conversationData = (extra: Values = {}): Values => ({
    channel: "telegram",
    connectionId: "22222222-2222-4222-8222-222222222222",
    externalId: "c1",
    name: "An",
    status: "ai",
    waiting: false,
    unanswered: false,
    handledBy: null,
    lastText: "",
    lastRole: null,
    lastAt: null,
    messageCount: 0,
    agentId: "33333333-3333-4333-8333-333333333333",
    frontAgentId: null,
    connectorPartyId: null,
    connectorPartyName: null,
    ...extra,
})

/** Puts a conversation into the fake store and answers it. */
export const addConversation = async (chat: FakeChat, extra: Values = {}): Promise<RecordRow> => {
    const written = await chat.api.ensure("chat.conversation", "none", conversationData(extra))
    if (!written.ok) throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotStored })
    return written.row
}
