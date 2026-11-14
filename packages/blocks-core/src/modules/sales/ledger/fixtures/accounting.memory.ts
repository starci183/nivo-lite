import type { ListSource } from "@nivo-lite/agent-sdk/block"
import type {
    AggregateRow,
    EntityAggregate,
    EntityApi,
    EntityQuery,
    JoinedRecord,
    ListPage as EnginePage,
    PageRow,
    RecordRow,
} from "@nivo-lite/agent-sdk/entity/port"
import {
    doorPort,
    outboxPort,
    workflowPort,
    type DoorApi,
    type OutboxApi,
    type WorkflowApi,
} from "@nivo-lite/agent-sdk/mutation"
import { unprovided, type PortDefinition, type PortProvider } from "@nivo-lite/agent-sdk/port"
import { queryProblems, type Aggregate, type MeasureSpec } from "@nivo-lite/agent-sdk/query"
import type {
    AdjustmentRecord,
    BookEntryRecord,
    ClaimRecord,
    InvoiceRecord,
    OrderRecord,
    TransactionRecord,
} from "../../../../rules/sales/ledger/accounting.types"
import type { MemberDirectory } from "../../../platform/platform.types"
import { membersPort } from "../../../platform/ports"
import type { EntryRow } from "../accounting.types"
import { bookEntryOf } from "../accounting-records"
import { ENTRIES_LIST } from "../ports"
import { compareBy, matches, pick, valueOf } from "./accounting.memory-rows"
import { CATALOG, putRecord, rowsOf, type MemoryWorld } from "./accounting.memory-world"
import { deleted, ensured, inserted, linked, updated, upserted } from "./accounting.memory-writes"
import {
    SALES_LEDGER_ADJUSTMENT_ENTITY,
    SALES_LEDGER_ENTRY_ENTITY,
    SALES_INVOICE_ENTITY,
    SALES_LEDGER_QUESTION_ENTITY,
    SALES_LEDGER_SETTINGS_ENTITY,
    SALES_TRANSACTION_ENTITY,
    SALES_CLAIM_ENTITY,
    SALES_LEAD_ENTITY,
    SALES_ORDER_ENTITY,
} from "../../../../entities/sales/sales-entity-names"

export { ACCOUNTANT_CONTEXT, ACCOUNTANT_ID, SYSTEM_CONTEXT, memoryWorld } from "./accounting.memory-world"
export type { MemoryCall, MemoryJob, MemoryLink } from "./accounting.memory-world"
export { putRecord, rowsOf }
export type { MemoryWorld }

/** Stores a transaction, linked to the order it paid when it paid one. */
export const putTransaction = (world: MemoryWorld, record: TransactionRecord): RecordRow => {
    const { id, version, ...data } = record
    return putRecord(world, SALES_TRANSACTION_ENTITY, id, data, {
        version,
        createdAt: record.occurredAt,
        links: record.orderId === null ? {} : { order: record.orderId },
    })
}

/** Stores an order, with the person it is for as a field. */
export const putOrder = (world: MemoryWorld, record: OrderRecord): RecordRow => {
    const { id, version, ...data } = record
    return putRecord(world, SALES_ORDER_ENTITY, id, data, { version })
}

/** Stores a claim, linked to its order and its conversation when it has them. */
export const putClaim = (world: MemoryWorld, record: ClaimRecord): RecordRow => {
    const { id, version, orderId, ...data } = record
    // The chat is the chatbot's record: the claim keeps its id as a plain field (no link).
    return putRecord(world, SALES_CLAIM_ENTITY, id, data, {
        version,
        links: orderId === null ? {} : { order: orderId },
    })
}

/** Stores an invoice, with the person billed as a field (its customer's name is the sale's record of that person). */
export const putInvoice = (world: MemoryWorld, record: InvoiceRecord): RecordRow => {
    const { id, createdAt, customer: _customer, ...data } = record
    return putRecord(world, SALES_INVOICE_ENTITY, id, data, { createdAt })
}

/** Stores a correction. */
export const putAdjustment = (world: MemoryWorld, record: AdjustmentRecord): RecordRow => {
    const { id, createdAt, ...data } = record
    return putRecord(world, SALES_LEDGER_ADJUSTMENT_ENTITY, id, data, { createdAt })
}

/** Stores a book entry. */
export const putBookEntry = (world: MemoryWorld, record: BookEntryRecord): RecordRow => {
    const { id, version, ...data } = record
    return putRecord(world, SALES_LEDGER_ENTRY_ENTITY, id, data, { version })
}

/** The fields of a question the department asked. */
export interface QuestionData {
    /** What it asks. */
    readonly text: string
    /** Where it came from, or null. */
    readonly source: string | null
    /** Open until somebody answers; absent means open. */
    readonly status?: string
}

/** Stores a question the department asked, asked at `createdAt`. */
export const putQuestion = (world: MemoryWorld, id: string, data: QuestionData, createdAt: string): RecordRow =>
    putRecord(world, SALES_LEDGER_QUESTION_ENTITY, id, { status: "open", ...data }, { createdAt })

/** Stores the settings row of the workspace. */
export const putSettings = (world: MemoryWorld, data: Readonly<Record<string, unknown>>): RecordRow =>
    putRecord(world, SALES_LEDGER_SETTINGS_ENTITY, "00000000-0000-4000-8000-0000000005e1", { scope: "workspace", ...data })

/** Stores the sale's record of a person: its name and the contact it is about. */
export const putLead = (world: MemoryWorld, id: string, contactName: string, contactId: string): RecordRow =>
    putRecord(world, SALES_LEAD_ENTITY, id, { contactName, contactId })

/** The record a toOne relation of a row links to, with the selected fields (none of them when the target was never stored); null when it links to none. */
const joinedOf = (
    world: MemoryWorld,
    entity: string,
    row: RecordRow,
    relation: string,
    select: ReadonlyArray<string>,
): JoinedRecord | null => {
    const link = world.links.find(
        (candidate) => candidate.entity === entity && candidate.id === row.id && candidate.relation === relation,
    )
    if (link === undefined) return null
    const target = [...world.tables.values()].flat().find((candidate) => candidate.id === link.to)
    return { id: link.to, data: pick(target?.data ?? {}, select) }
}

/** The codes of what the planner refuses in a tree over an entity: the fake refuses what the engine would. */
const problemsOf = (tree: Parameters<typeof queryProblems>[0]): ReadonlyArray<string> =>
    queryProblems(tree, CATALOG).map((problem) => problem.code)

/** One page of a query over an entity. */
const listed = (world: MemoryWorld, entity: string, query: EntityQuery): EnginePage => {
    const found = rowsOf(world, entity)
        .filter((row) => matches(row, query.where))
        .toSorted(compareBy(query.order))
    const from = query.page.after === undefined ? 0 : Number(query.page.after)
    const rows = found.slice(from, from + query.page.size).map((row): PageRow => ({
        row: { ...row, data: pick(row.data, query.select) },
        joined: Object.fromEntries(
            Object.entries(query.join ?? {}).map(([relation, select]) => [
                relation,
                joinedOf(world, entity, row, relation, select),
            ]),
        ),
        position: [],
        included: {},
    }))
    const end = from + query.page.size
    return { rows, next: end < found.length ? String(end) : null }
}

/** The number a measure of one group comes to. */
const measured = (rows: ReadonlyArray<RecordRow>, spec: MeasureSpec): number | null => {
    const counted = rows.filter((row) => matches(row, spec.where))
    if (spec.kind === "count") return counted.length
    const values = counted.flatMap((row) => {
        const value = valueOf(row, String(spec.field))
        return typeof value === "number" ? [value] : []
    })
    return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0)
}

/** The groups and measures of an aggregate over an entity: count and sum, the measures the module asks for. */
const aggregated = (world: MemoryWorld, entity: string, aggregate: EntityAggregate): ReadonlyArray<AggregateRow> => {
    const by = aggregate.groupBy ?? []
    const found = rowsOf(world, entity).filter((row) => matches(row, aggregate.where))
    const keyOf = (row: RecordRow): ReadonlyArray<string> => by.map((field) => String(valueOf(row, field)))
    const keys = [...new Set(found.map((row) => keyOf(row).join("|")))].toSorted((a, b) => a.localeCompare(b))
    const groups = by.length === 0 ? [""] : keys
    return groups.map((key) => {
        const members = found.filter((row) => keyOf(row).join("|") === key)
        const values = key.split("|")
        return {
            groups: Object.fromEntries(by.map((field, index) => [field, String(values[index])])),
            measures: Object.fromEntries(
                Object.entries(aggregate.measures).map(([name, spec]) => [name, measured(members, spec)]),
            ),
        }
    })
}

/** What the fake engine does not do. */
const unsupported = (): Promise<never> => Promise.reject(new Error("The fake engine does not run this call."))

/** The data port of one entity over a world: the calls the module makes. */
export const entityApi = (world: MemoryWorld, entity: string): EntityApi => ({
    get: (id) => Promise.resolve(rowsOf(world, entity).find((row) => row.id === id) ?? null),
    list: (query) => {
        const problems = problemsOf({ from: entity, ...query })
        return problems.length > 0
            ? Promise.reject(new Error(`The planner refuses the query: ${problems.join(",")}`))
            : Promise.resolve(listed(world, entity, query))
    },
    aggregate: (aggregate) => {
        const tree: Aggregate = { from: entity, ...aggregate }
        const problems = problemsOf(tree)
        return problems.length > 0
            ? Promise.reject(new Error(`The planner refuses the aggregate: ${problems.join(",")}`))
            : Promise.resolve(aggregated(world, entity, aggregate))
    },
    insert: (values, links) => Promise.resolve(inserted(world, entity, values, links)),
    update: (key, expected, values) => Promise.resolve(updated(world, entity, key, expected, values)),
    upsert: (on, values) => Promise.resolve(upserted(world, entity, on, values)),
    link: (key, relation, to) => Promise.resolve(linked(world, entity, key, relation, to)),
    ensure: (match, values) => Promise.resolve(ensured(world, entity, match, values)),
    delete: (key, expected) => Promise.resolve(deleted(world, entity, key, expected)),
    unlink: unsupported,
})

/** The entries list over a world: every book entry, newest day first, and the counts of the kinds. */
export const entriesList = (world: MemoryWorld): ListSource<EntryRow> => ({
    page: (_shape, query) => {
        const rows = rowsOf(world, SALES_LEDGER_ENTRY_ENTITY)
            .filter((row) => query.filters["kind"] === undefined || row.data["kind"] === query.filters["kind"])
            .filter((row) => query.filters["status"] === undefined || row.data["status"] === query.filters["status"])
            .toSorted(compareBy([["id", "asc"]]))
            .flatMap((row): ReadonlyArray<EntryRow> => {
                const entry = bookEntryOf(row)
                return entry === null
                    ? []
                    : [
                          {
                              id: row.id,
                              note: entry.note,
                              entryDate: entry.entryDate,
                              kind: entry.kind,
                              amountVnd: entry.amountVnd,
                              status: entry.status,
                              counterparty: entry.counterparty,
                          },
                      ]
            })
        return Promise.resolve({ rows, cursor: null })
    },
    counts: (_shape, by) => {
        const counts: Record<string, number> = {}
        for (const row of rowsOf(world, SALES_LEDGER_ENTRY_ENTITY)) {
            const value = String(row.data[by])
            counts[value] = (counts[value] ?? 0) + 1
        }
        return Promise.resolve(counts)
    },
})

const memberDirectory = (world: MemoryWorld): MemberDirectory => ({
    get: (memberId) => Promise.resolve(world.members.get(memberId) ?? null),
})

/** The outbox of a world: every job enqueued is kept in `world.jobs`, for a spec to read. */
export const outbox = (world: MemoryWorld): OutboxApi => ({
    enqueue: (job, input, options) => {
        world.jobs.push({ job: job.name, input, dedupeKey: options?.dedupeKey })
        return Promise.resolve()
    },
})

/** The door over a world: records what it was asked and answers what the world says for the tool. */
export const doorApi = (world: MemoryWorld): DoorApi => ({
    call: (tool, input) => {
        world.calls.push({ tool, input })
        return Promise.resolve(world.answers.get(tool) ?? { ok: false, reason: "unknown_tool", message: tool })
    },
})

/** The workflow port over a world: records each start once per dedupe key, as the engine wakes the workflow once per key. */
export const workflowApi = (world: MemoryWorld): WorkflowApi => ({
    start: (request) => {
        if (world.starts.some((start) => start.dedupeKey === request.dedupeKey))
            return Promise.resolve({ started: false, reason: "duplicate" })
        world.starts.push(request)
        return Promise.resolve({ started: true })
    },
})

/** The ports of the module over a world, by id. */
const portsOf = (world: MemoryWorld): ReadonlyArray<readonly [string, unknown]> => [
    ...[
        SALES_TRANSACTION_ENTITY,
        SALES_ORDER_ENTITY,
        SALES_CLAIM_ENTITY,
        SALES_INVOICE_ENTITY,
        SALES_LEDGER_ADJUSTMENT_ENTITY,
        SALES_LEAD_ENTITY,
        SALES_LEDGER_ENTRY_ENTITY,
        SALES_LEDGER_QUESTION_ENTITY,
        SALES_LEDGER_SETTINGS_ENTITY,
    ].map((entity): readonly [string, unknown] => [`engine.entity.${entity}`, entityApi(world, entity)]),
    [ENTRIES_LIST.id, entriesList(world)],
    [membersPort.id, memberDirectory(world)],
    [outboxPort.id, outbox(world)],
    [doorPort.id, doorApi(world)],
    [workflowPort.id, workflowApi(world)],
]

/** The implementation of each port of the module over a world; a port outside the module is unprovided. */
export const memoryProvider = (world: MemoryWorld): PortProvider => {
    const implementations = new Map(portsOf(world))
    return {
        implementationOf: (port: PortDefinition<unknown>): unknown =>
            implementations.has(port.id) ? implementations.get(port.id) : unprovided(port),
    }
}

/** The provider of a world whose port for one entity answers `patch` where it names a call: a spec makes a write fail with it. */
export const withEntity = (world: MemoryWorld, entity: string, patch: Partial<EntityApi>): PortProvider => {
    const base = memoryProvider(world)
    const id = `engine.entity.${entity}`
    return {
        implementationOf: (port: PortDefinition<unknown>): unknown =>
            port.id === id ? { ...entityApi(world, entity), ...patch } : base.implementationOf(port),
    }
}
