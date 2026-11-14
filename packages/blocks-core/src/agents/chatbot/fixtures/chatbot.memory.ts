import type { ListPage, ListQuery, ListShape } from "@nivo-lite/agent-sdk/block"
import type {
    EngineResult,
    EntityApi,
    EntityQuery,
    ListPage as EnginePage,
    PageRow,
    RecordRow,
    WriteLinks,
    WriteValues,
} from "@nivo-lite/agent-sdk/entity/port"
import { doorPort, outboxPort } from "@nivo-lite/agent-sdk/mutation"
import type { DoorApi, DoorCallOptions, DoorCallResult, OutboxApi } from "@nivo-lite/agent-sdk/mutation"
import {
    customerMessagesPort,
    routeHoldsPort,
    type CustomerLine,
    type CustomerMessages,
    type RouteHolds,
    type RouteHoldView,
} from "@nivo-lite/agent-sdk/platform"
import { unprovided } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition, PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { EntityCatalog, FilterExpr, OrderBy } from "@nivo-lite/agent-sdk/query"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { FLOW_F_ENTITIES } from "../../../shared/entities/flow-f.entities"
import type { MemberDirectory, MemberFacts } from "../../../shared/platform/platform.types"
import { membersPort } from "../../../shared/platform/ports"
import { threadRowOf } from "../chatbot-records"
import type { ThreadRow } from "../chatbot.types"
import { CONVERSATIONS, NOTES, REPLIES, SETTINGS, THREADS_LIST } from "../ports"
import type { ThreadsList } from "../ports"
import { HANDLED_ROW, THREAD_ROWS } from "./chatbot.fixtures"
import {
    CHATBOT_CHAT_ENTITY,
    CHATBOT_NOTE_ENTITY,
    CHATBOT_REPLY_ENTITY,
    CHATBOT_SETTINGS_ENTITY,
} from "../../../shared/entities/chatbot-entity-names"

/** The member of the fake workspace who is staff. */
export const STAFF_ID = "member-staff"

/** The member of the fake workspace who is a manager. */
export const MANAGER_ID = "member-manager"

/** A request scope of the staff member at a fixed instant. */
export const STAFF_CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: STAFF_ID,
    now: new Date("2026-11-05T03:00:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

/** The instant every fake record was created and last written at. */
const CREATED = "2026-11-03T09:00:00.000Z"

/** The entities the fake engine knows, the way the planner checks a query against them. */
const CATALOG: EntityCatalog = new Map(FLOW_F_ENTITIES.map((entity) => [entity.name, entity]))

/** One link the fake engine holds: a record of an entity linked to another over a relation. */
export interface MemoryLink {
    /** The entity of the record that is linked. */
    readonly entity: string
    /** The id of the record that is linked. */
    readonly id: string
    /** The relation. */
    readonly relation: string
    /** The id of the target record. */
    readonly to: string
}

/** One call the fake door was given. */
export interface MemorySend {
    /** The door tool. */
    readonly tool: string
    /** The input of the call. */
    readonly input: Readonly<Record<string, JsonValue>>
    /** What the job said about the call beside its input (the business key, the route), when it said anything. */
    readonly options?: DoorCallOptions | undefined
}

/** One job the fake outbox was asked to enqueue. */
export interface MemoryJob {
    /** The job name. */
    readonly job: string
    /** Its input. */
    readonly input: unknown
}

/** Everything the fake ports read and record, so a spec can set it up and look at it. */
export interface MemoryWorld {
    /** The `blocks-core.chatbot.chat` records. */
    readonly conversations: Array<RecordRow>
    /** The `blocks-core.chatbot.settings` records. */
    readonly settings: Array<RecordRow>
    /** The links between records. */
    readonly links: Array<MemoryLink>
    /** The members by id. */
    readonly members: Map<string, MemberFacts>
    /** The jobs the outbox was asked for. */
    readonly jobs: Array<MemoryJob>
    /** What the door was asked to send. */
    readonly sends: Array<MemorySend>
    /** The queries the list source was asked a page for. */
    readonly queries: Array<ListQuery>
    /** The engine's lines of the conversations (`platform.customer-messages`, both directions); empty by default. */
    readonly said: Array<CustomerLine>
    /** The chatbot's notes (`blocks-core.chatbot.note`). */
    readonly notes: Array<RecordRow>
    /** The replies members typed, until handed to the engine (`blocks-core.chatbot.reply`). */
    readonly replies: Array<RecordRow>
    /** The engine's staff holds by route id (`platform.route-holds`, ruling R43): the one place that says who holds a thread. */
    readonly holds: Map<string, RouteHoldView>
    /** What the door answers. */
    door: DoorCallResult
}

/** The record the fake engine holds for a conversation row. */
export const recordOfThread = (row: ThreadRow): RecordRow => {
    const { id, version, ...data } = row
    return { id, workspaceId: "w1", version, createdAt: CREATED, updatedAt: CREATED, data }
}

/** The conversation row of a world, or null when it holds none by this id. */
export const conversationOf = (world: MemoryWorld, id: string): ThreadRow | null => {
    const record = world.conversations.find((candidate) => candidate.id === id)
    return record === undefined ? null : threadRowOf(record)
}

/** Sets a conversation of a world: replaces the one with the row's id, or adds it. */
export const putConversation = (world: MemoryWorld, row: ThreadRow): void => {
    const index = world.conversations.findIndex((candidate) => candidate.id === row.id)
    world.conversations.splice(index < 0 ? world.conversations.length : index, index < 0 ? 0 : 1, recordOfThread(row))
}

/** A world holding the fixture conversations, a staff member and a manager, the staff member's hold on the held chat's route, and no engine lines. */
export const memoryWorld = (): MemoryWorld => ({
    conversations: THREAD_ROWS.map(recordOfThread),
    settings: [],
    links: [],
    members: new Map([
        [STAFF_ID, { displayName: "Thu Ha Le", isManager: false }],
        [MANAGER_ID, { displayName: "Lan Pham", isManager: true }],
    ]),
    jobs: [],
    sends: [],
    queries: [],
    said: [],
    notes: [],
    replies: [],
    holds: new Map([[HANDLED_ROW.routeId ?? "", { memberId: STAFF_ID, at: "2026-11-04T00:30:00.000Z" }]]),
    door: { ok: true, output: null },
})

/** The next version token of a record. */
const nextVersion = (version: string): string => String(Number(version) + 1)

/** The value of a field of a record: a system field, else a declared one. */
const valueOf = (row: RecordRow, field: string): unknown => (field === "id" ? row.id : row.data[field])

/** Whether a record matches a condition; the fake knows `eq`, `gte`, `lte` (ISO text compares in time order) and `and`, the conditions the module writes. */
const matches = (row: RecordRow, where: FilterExpr | undefined): boolean => {
    if (where === undefined) return true
    if (where.op === "and") return where.of.every((part) => matches(row, part))
    if (where.op === "gte" || where.op === "lte") {
        const value = valueOf(row, where.field)
        return typeof value === "string" && typeof where.value === "string" && (where.op === "gte" ? value >= where.value : value <= where.value)
    }
    return where.op === "eq" && valueOf(row, where.field) === where.value
}

/** -1, 0 or 1 as the first text sorts before, with or after the second. */
const signOf = (left: string, right: string): number => {
    if (left === right) return 0
    return left < right ? -1 : 1
}

/** The comparison of two records under an order. */
const compareBy =
    (order: OrderBy) =>
    (a: RecordRow, b: RecordRow): number =>
        order.reduce((decided, [field, direction]) => {
            if (decided !== 0) return decided
            const left = String(valueOf(a, field))
            const right = String(valueOf(b, field))
            return signOf(left, right) * (direction === "asc" ? 1 : -1)
        }, 0)

/** The fields of a record of data limited to the selected ones. */
const pick = (data: Readonly<Record<string, unknown>>, select: ReadonlyArray<string>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(data).filter(([field]) => select.includes(field)))

/** The rows of a keyset page: `size` rows from the offset the cursor names, and the cursor of the rest. */
const slicePage = <T>(rows: ReadonlyArray<T>, cursor: string | null, size: number): ListPage<T> => {
    const from = cursor === null ? 0 : Number(cursor)
    return { rows: rows.slice(from, from + size), cursor: from + size < rows.length ? String(from + size) : null }
}

/** The record a declared unique constraint of the table's entity names holds, by the values of its fields. */
const matching = (table: Table, on: string, values: WriteValues): RecordRow | undefined => {
    const constraint = CATALOG.get(table.entity)?.constraints?.find((candidate) => candidate.name === on)
    if (constraint?.kind !== "unique") return undefined
    const fields = constraint.on
    return table.rows.find((row) => fields.every((field) => valueOf(row, field) === values[field]))
}

/** What the fake engine does not do. */
const unsupported = (): Promise<never> => Promise.reject(new Error("The fake engine does not run this call."))

/** How a table of the fake engine reaches the rest of the world. */
interface Table {
    /** The entity the table holds. */
    readonly entity: string
    /** The prefix of the ids the table mints. */
    readonly prefix: string
    /** The records. */
    readonly rows: Array<RecordRow>
    /** The world, for the links. */
    readonly world: MemoryWorld
}

/** The codes of what the planner refuses in a query over a table: the fake refuses what the engine would. */
const problemsOf = (table: Table, query: EntityQuery): ReadonlyArray<string> =>
    queryProblems({ from: table.entity, ...query }, CATALOG).map((problem) => problem.code)

/** One page of a query over a table. */
const listed = (table: Table, query: EntityQuery): EnginePage => {
    const found = table.rows.filter((row) => matches(row, query.where)).toSorted(compareBy(query.order))
    const page = slicePage(found, query.page.after ?? null, query.page.size)
    const rows = page.rows.map((row): PageRow => ({
        row: { ...row, data: pick(row.data, query.select) },
        joined: {},
        position: [],
        included: {},
    }))
    return { rows, next: page.cursor }
}

/** Stores a record and the links it carries. */
const inserted = (table: Table, values: WriteValues, links: WriteLinks = {}): EngineResult => {
    const row: RecordRow = {
        id: `${table.prefix}${table.rows.length + 1}`,
        workspaceId: "w1",
        version: "1",
        createdAt: CREATED,
        updatedAt: CREATED,
        data: values,
    }
    table.rows.push(row)
    for (const [relation, to] of Object.entries(links))
        table.world.links.push({ entity: table.entity, id: row.id, relation, to })
    return { ok: true, row, version: row.version, created: true }
}

/** Sets fields of a record whose version is the expected one. */
const updated = (table: Table, key: string, expected: string, values: WriteValues): EngineResult => {
    const index = table.rows.findIndex((row) => row.id === key)
    const row = table.rows[index]
    if (row === undefined) return { ok: false, reason: "missing" }
    if (row.version !== expected) return { ok: false, reason: "stale" }
    const next: RecordRow = { ...row, version: nextVersion(row.version), data: { ...row.data, ...values } }
    table.rows[index] = next
    return { ok: true, row: next, version: next.version }
}

/** Writes a record by the unique constraint it carries: sets the fields of the one that holds the same key, else stores a new one. */
const upserted = (table: Table, on: string, values: WriteValues): EngineResult => {
    const found = matching(table, on, values)
    return found === undefined ? inserted(table, values) : updated(table, found.id, found.version, values)
}

/** The data port of one entity over a table of the fake engine: get, list, insert, update and upsert, the calls the module makes. */
const entityApi = (table: Table): EntityApi => ({
    get: (id) => Promise.resolve(table.rows.find((row) => row.id === id) ?? null),
    list: (query) => {
        const problems = problemsOf(table, query)
        return problems.length > 0
            ? Promise.reject(new Error(`The planner refuses the query: ${problems.join(",")}`))
            : Promise.resolve(listed(table, query))
    },
    insert: (values, links) => Promise.resolve(inserted(table, values, links)),
    update: (key, expected, values) => Promise.resolve(updated(table, key, expected, values)),
    aggregate: unsupported,
    upsert: (on, values) => Promise.resolve(upserted(table, on, values)),
    ensure: unsupported,
    delete: unsupported,
    link: unsupported,
    unlink: unsupported,
})

/** The `blocks-core.chatbot.chat` port over a world. */
export const conversationApi = (world: MemoryWorld): EntityApi =>
    entityApi({ entity: CHATBOT_CHAT_ENTITY, prefix: "c", rows: world.conversations, world })

/** The `blocks-core.chatbot.note` port over a world. */
export const noteApi = (world: MemoryWorld): EntityApi =>
    entityApi({ entity: CHATBOT_NOTE_ENTITY, prefix: "n", rows: world.notes, world })

/** The `blocks-core.chatbot.reply` port over a world. */
export const replyApi = (world: MemoryWorld): EntityApi =>
    entityApi({ entity: CHATBOT_REPLY_ENTITY, prefix: "r", rows: world.replies, world })

/** The `blocks-core.chatbot.settings` port over a world. */
export const settingsApi = (world: MemoryWorld): EntityApi =>
    entityApi({ entity: CHATBOT_SETTINGS_ENTITY, prefix: "s", rows: world.settings, world })

/** The inbox rows of the conversations of a world. */
const threadRowsOf = (world: MemoryWorld, query?: ListQuery): Array<ThreadRow> =>
    world.conversations.flatMap((record) => {
        const row = threadRowOf(record)
        const at = row?.lastAt ?? ""
        const isWithin = Object.values(query?.windows ?? {}).every((window) => at >= window.from && at < window.to)
        return row === null || !isWithin ? [] : [row]
    })

/** The list source over a world. */
export const threadsList = (world: MemoryWorld): ThreadsList => ({
    page: (_shape: ListShape, query: ListQuery) => {
        world.queries.push(query)
        return Promise.resolve(slicePage(threadRowsOf(world, query), query.cursor, query.size))
    },
    counts: (_shape: ListShape, by: string, query: ListQuery) => {
        const counts: Record<string, number> = {}
        for (const row of threadRowsOf(world, query)) {
            const value = by === "channel" ? row.channel : row.status
            counts[value] = (counts[value] ?? 0) + 1
        }
        return Promise.resolve(counts)
    },
})

const memberDirectory = (world: MemoryWorld): MemberDirectory => ({
    get: (memberId) => Promise.resolve(world.members.get(memberId) ?? null),
})

const outbox = (world: MemoryWorld): OutboxApi => ({
    enqueue: (job, input) => {
        world.jobs.push({ job: job.name, input })
        return Promise.resolve()
    },
})

/** The door over a world: records what it was asked and answers what the world says. */
export const doorApi = (world: MemoryWorld): DoorApi => ({
    call: (tool, input, options) => {
        world.sends.push({ tool, input, ...(options === undefined ? {} : { options }) })
        return Promise.resolve(world.door)
    },
})

/** The engine's conversation port over a world: the lines of a route or a person from `since` on, newest first, `limit` at a time. */
const linesOf = (world: MemoryWorld): CustomerMessages => {
    const page = (lines: ReadonlyArray<CustomerLine>, ask?: { readonly limit?: number | undefined; readonly after?: string | null | undefined; readonly since?: string | null | undefined }) => {
        const since = ask?.since ?? null
        const newest = lines
            .filter((line) => since === null || line.saidAt >= since)
            .toSorted((left, right) => right.saidAt.localeCompare(left.saidAt) || right.id.localeCompare(left.id))
        const start = ask?.after === undefined || ask.after === null ? 0 : Number(ask.after)
        const limit = ask?.limit ?? 50
        const end = start + limit
        return { lines: newest.slice(start, end), next: end < newest.length ? String(end) : null }
    }
    return {
        byRoute: (routeId, ask) => Promise.resolve(page(world.said.filter((line) => line.routeId === routeId), ask)),
        byContact: (contactId, ask) => Promise.resolve(page(world.said.filter((line) => line.contactId === contactId), ask)),
    }
}

/**
 * The engine's staff hold over a world, acting as `actor` (the door run's member): `take` on a route no chat of the world names is
 * `not_found`; a hand-back clears the hold (a resume event is the engine's, not faked here).
 */
export const routeHoldsOf = (world: MemoryWorld, actor: string): RouteHolds => {
    const known = (routeId: string): boolean => world.conversations.some((row) => row.data["routeId"] === routeId)
    return {
        take: (routeId) => {
            if (!known(routeId)) return Promise.resolve("not_found")
            if (world.holds.get(routeId)?.memberId !== actor) world.holds.set(routeId, { memberId: actor, at: CREATED })
            return Promise.resolve("held")
        },
        holderOf: (routeId) => Promise.resolve(world.holds.get(routeId) ?? null),
        handBack: (routeId) => {
            if (!known(routeId)) return Promise.resolve({ outcome: "not_found", answered: 0 })
            const held = world.holds.delete(routeId)
            return Promise.resolve({ outcome: held ? "released" : "nothing_held", answered: 0 })
        },
        held: (limit) => {
            const routes = [...world.holds.entries()]
                .filter(([routeId]) => known(routeId))
                .map(([routeId, hold]) => ({ routeId, ...hold }))
                .toSorted((left, right) => right.at.localeCompare(left.at))
            return Promise.resolve({ count: routes.length, routes: routes.slice(0, limit) })
        },
    }
}

/** The implementation of each port of the module over a world, the engine ports acting as `actor`; a port outside the module is unprovided. */
export const memoryProvider = (world: MemoryWorld, actor: string = STAFF_ID): PortProvider => ({
    implementationOf: (port: PortDefinition<unknown>): unknown => {
        if (port.id === THREADS_LIST.id) return threadsList(world)
        if (port.id === CONVERSATIONS.id) return conversationApi(world)
        if (port.id === NOTES.id) return noteApi(world)
        if (port.id === REPLIES.id) return replyApi(world)
        if (port.id === customerMessagesPort.id) return linesOf(world)
        if (port.id === routeHoldsPort.id) return routeHoldsOf(world, actor)
        if (port.id === SETTINGS.id) return settingsApi(world)
        if (port.id === membersPort.id) return memberDirectory(world)
        if (port.id === outboxPort.id) return outbox(world)
        if (port.id === doorPort.id) return doorApi(world)
        return unprovided(port)
    },
})
