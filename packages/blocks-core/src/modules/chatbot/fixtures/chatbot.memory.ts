import type { ListPage, ListQuery, ListShape } from "@nivo-lite/agent-sdk/block"
import type {
    EngineResult,
    EntityApi,
    EntityQuery,
    JoinedRecord,
    ListPage as EnginePage,
    PageRow,
    RecordRow,
    WriteLinks,
    WriteValues,
} from "@nivo-lite/agent-sdk/entity/port"
import { doorPort, outboxPort } from "@nivo-lite/agent-sdk/mutation"
import type { DoorApi, DoorCallResult, OutboxApi } from "@nivo-lite/agent-sdk/mutation"
import { unprovided } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition, PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { EntityCatalog, FilterExpr, OrderBy } from "@nivo-lite/agent-sdk/query"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { FLOW_F_ENTITIES } from "../../../entities/flow-f.entities"
import type { MemberDirectory, MemberFacts } from "../../platform/platform.types"
import { membersPort } from "../../platform/ports"
import { threadRowOf } from "../chatbot-records"
import type { ThreadRow } from "../chatbot.types"
import { CONVERSATIONS, MESSAGES, THREADS_LIST } from "../ports"
import type { ThreadsList } from "../ports"
import { THREAD_ROWS } from "./chatbot.fixtures"

/** The member of the fake workspace who is staff. */
export const STAFF_ID = "member-staff"

/** The member of the fake workspace who is a manager. */
export const MANAGER_ID = "member-manager"

/** A request scope of the staff member at a fixed instant. */
export const STAFF_CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: STAFF_ID,
    now: new Date("2026-11-05T03:00:00.000Z"),
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
    /** The `chat.conversation` records. */
    readonly conversations: Array<RecordRow>
    /** The `chat.message` records, oldest first. */
    readonly lines: Array<RecordRow>
    /** The declared fields of the `sales.lead` records, by id. */
    readonly leads: Map<string, Readonly<Record<string, unknown>>>
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

/** A world holding the fixture conversations, a staff member and a manager, one customer linked to the first conversation and no lines. */
export const memoryWorld = (): MemoryWorld => ({
    conversations: THREAD_ROWS.map(recordOfThread),
    lines: [],
    leads: new Map([
        [
            "l1",
            {
                contactName: "Minh Anh Nguyen",
                company: "Lotus Studio",
                stage: "qualified",
                need: "Two flower pots",
                phone: "0901234567",
                email: "minh@example.com",
            },
        ],
    ]),
    links: [{ entity: "chat.conversation", id: "c1", relation: "lead", to: "l1" }],
    members: new Map([
        [STAFF_ID, { displayName: "Thu Ha Le", isManager: false }],
        [MANAGER_ID, { displayName: "Lan Pham", isManager: true }],
    ]),
    jobs: [],
    sends: [],
    queries: [],
    door: { ok: true, output: null },
})

/** The next version token of a record. */
const nextVersion = (version: string): string => String(Number(version) + 1)

/** The value of a field of a record: a system field, else a declared one. */
const valueOf = (row: RecordRow, field: string): unknown => (field === "id" ? row.id : row.data[field])

/** Whether a record matches a condition; the fake knows `eq` and `and` only, the conditions the module writes. */
const matches = (row: RecordRow, where: FilterExpr | undefined): boolean => {
    if (where === undefined) return true
    if (where.op === "and") return where.of.every((part) => matches(row, part))
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
    /** The world, for links and joined records. */
    readonly world: MemoryWorld
}

/** The record a toOne relation of a row links to, with the selected fields; null when it links to none. */
const joinedOf = (
    table: Table,
    row: RecordRow,
    relation: string,
    select: ReadonlyArray<string>,
): JoinedRecord | null => {
    const link = table.world.links.find(
        (candidate) => candidate.entity === table.entity && candidate.id === row.id && candidate.relation === relation,
    )
    const data = link === undefined ? undefined : table.world.leads.get(link.to)
    return link === undefined || data === undefined ? null : { id: link.to, data: pick(data, select) }
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
        joined: Object.fromEntries(
            Object.entries(query.join ?? {}).map(([relation, select]) => [
                relation,
                joinedOf(table, row, relation, select),
            ]),
        ),
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
        data: table.entity === "chat.message" ? { status: "posted", ...values } : values,
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

/** The data port of one entity over a table of the fake engine: get, list, insert and update, the calls the module makes. */
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
    upsert: unsupported,
    ensure: unsupported,
    delete: unsupported,
    link: unsupported,
    unlink: unsupported,
})

/** The `chat.conversation` port over a world. */
export const conversationApi = (world: MemoryWorld): EntityApi =>
    entityApi({ entity: "chat.conversation", prefix: "c", rows: world.conversations, world })

/** The `chat.message` port over a world. */
export const messageApi = (world: MemoryWorld): EntityApi =>
    entityApi({ entity: "chat.message", prefix: "m", rows: world.lines, world })

/** The inbox rows of the conversations of a world. */
const threadRowsOf = (world: MemoryWorld): Array<ThreadRow> =>
    world.conversations.flatMap((record) => {
        const row = threadRowOf(record)
        return row === null ? [] : [row]
    })

/** The list source over a world. */
export const threadsList = (world: MemoryWorld): ThreadsList => ({
    page: (_shape: ListShape, query: ListQuery) => {
        world.queries.push(query)
        return Promise.resolve(slicePage(threadRowsOf(world), query.cursor, query.size))
    },
    counts: (_shape: ListShape, by: string) => {
        const counts: Record<string, number> = {}
        for (const row of threadRowsOf(world)) {
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
    call: (tool, input) => {
        world.sends.push({ tool, input })
        return Promise.resolve(world.door)
    },
})

/** The implementation of each port of the module over a world; a port outside the module is unprovided. */
export const memoryProvider = (world: MemoryWorld): PortProvider => ({
    implementationOf: (port: PortDefinition<unknown>): unknown => {
        if (port.id === THREADS_LIST.id) return threadsList(world)
        if (port.id === CONVERSATIONS.id) return conversationApi(world)
        if (port.id === MESSAGES.id) return messageApi(world)
        if (port.id === membersPort.id) return memberDirectory(world)
        if (port.id === outboxPort.id) return outbox(world)
        if (port.id === doorPort.id) return doorApi(world)
        return unprovided(port)
    },
})
