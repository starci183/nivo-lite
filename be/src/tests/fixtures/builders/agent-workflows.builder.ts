import type { Provider, Type } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { FakeClock, mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { AnyEntityDefinition, FieldDefault } from "@nivo-lite/agent-sdk/entity"
import type { EngineResult, ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Mutation, MutationValues } from "@nivo-lite/agent-sdk/mutation"
import type { FilterExpr, Query } from "@nivo-lite/agent-sdk/query"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import { AgentGraphsService, type GraphVersionView } from "@modules/domain/agent-graphs"
import { AGENT_GRAPH_STORE } from "@modules/domain/agent-graphs/agent-graph-store.port"
import { AGENT_WORKFLOW_STORE } from "@modules/domain/agent-graphs/agent-workflow-store.port"
import { AgentRunRecordsService } from "@modules/domain/agent-runs"
import { EntityEngineService, EntityMutationService, type ScopedTx } from "@modules/domain/entity-engine"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { pageOf, wireScope } from "./agent-graph-records.builder"
import {
    CORE_TABLE_KEYS,
    keyTaken,
    memoryGraphStore,
    memoryRunStore,
    memoryWorkflowStore,
    type TableRows,
} from "./engine-core-tables.builder"

/** The time every row of the memory engine is stamped with. */
const STAMP = "2026-11-09T02:00:00.000Z"

/** The empty graph of a template that is not there; the specs only read templates that are. */
const NO_GRAPH: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "none",
    trigger: { kind: "tag", sources: [] },
    grant: { tools: [], effects: [] },
    nodes: [],
}

/** The graph of a shipped template: that of its newest version (every shipped template holds one version). */
export const templateGraph = (id: string): GraphSpec => {
    const template = INSTALLED.templateOf(id)
    return template === null ? NO_GRAPH : latestTemplateVersion(template).graph
}

/** The number of the newest version of a shipped template; 0 for a template that is not there. */
export const templateNewest = (id: string): number => {
    const template = INSTALLED.templateOf(id)
    return template === null ? 0 : latestTemplateVersion(template).version
}

/** The group the owner's one change puts the last step of a graph in. */
export const SHOP_GROUP = "shop"

/** A graph with the owner's one change: its LAST step moved to the group `SHOP_GROUP`. One step differs, and the graph runs the same. */
export const ownerEdited = (graph: GraphSpec): GraphSpec => ({
    ...graph,
    nodes: graph.nodes.map((node, at) => (at === graph.nodes.length - 1 ? { ...node, group: SHOP_GROUP } : node)),
})

/**
 * The primary graph the demo shop runs: the invoice template of `webbooks` (the module's primary, the stand-in of the dropped accounting
 * agent: a living agent with five graphs, none of which hands off to another agent), with the owner's one change.
 */
export const shopAccountingGraph = (): GraphSpec => ownerEdited(templateGraph("webbooks.invoice"))

/**
 * The bank-credit graph of a second living agent, `sales`: the payment template (it wakes on a bank credit, a system event, and hands off
 * to `sales.after-sale` INSIDE the same agent), with the owner's one change. The stand-in of the dropped accounting agent's reconcile graph
 * for the specs whose subject is a wake routed to the primary workflow. A spec that publishes it makes `sales.after-sale` first (the
 * * contract check wants the callee there). It runs as the primary of the world agent (module `webbooks`).
 */
export const shopCreditGraph = (): GraphSpec => ({ ...ownerEdited(templateGraph("sales.payment")), moduleKey: "webbooks" })

const CATALOG: ReadonlyMap<string, AnyEntityDefinition> = new Map(
    INSTALLED.entities().map((entity) => [entity.name, entity]),
)

const defaultOf = (value: FieldDefault | undefined): unknown => {
    if (value === undefined) return null
    if (value === "now") return STAMP
    if (value === "empty") return ""
    if (value === "uuid") return "00000000-0000-4000-8000-000000000000"
    return value.literal
}

const valueOf = (row: RecordRow, field: string): unknown => {
    if (field === "id") return row.id
    if (field === "createdAt") return row.createdAt
    if (field === "updatedAt") return row.updatedAt
    return row.data[field]
}

const matches = (row: RecordRow, where: FilterExpr | undefined): boolean => {
    if (where === undefined) return true
    if (where.op === "and") return where.of.every((part) => matches(row, part))
    if (where.op === "eq") return valueOf(row, where.field) === where.value
    if (where.op === "in") return where.values.includes(String(valueOf(row, where.field)))
    return true
}

const compare = (left: unknown, right: unknown): number => {
    if (typeof left === "number" && typeof right === "number") return left - right
    return (typeof left === "string" ? left : "").localeCompare(typeof right === "string" ? right : "")
}

const ordered = (rows: ReadonlyArray<RecordRow>, query: Query): ReadonlyArray<RecordRow> =>
    rows.toSorted((left, right) => {
        const order = (query.order ?? []).map(([field, direction]) => {
            const delta = compare(valueOf(left, field), valueOf(right, field))
            return direction === "asc" ? delta : -delta
        })
        return order.find((delta) => delta !== 0) ?? 0
    })

/**
 * An in-memory entity engine: the rows of each entity, read by id or by a list query (eq, in and and filters, the order, the page
 * size), and written by insert, by update under the record version, and by ensure under a match key, with the unique constraints and
 * the field defaults of the blocks-core entity declarations. The double of the engine and of the mutation port for a store's specs, and
 * the database of the core-table doubles (`TableRows`: the graphs, workflows and runs under their table names and unique keys), whose
 * writes join the same transactions and failures.
 */
export class MemoryEngine implements TableRows {
    readonly engine: ReturnType<typeof mock<EntityEngineService>> = mock<EntityEngineService>()
    readonly mutations: ReturnType<typeof mock<EntityMutationService>> = mock<EntityMutationService>()
    private readonly tables: Map<string, Map<string, RecordRow>> = new Map()
    private readonly undo: Map<ScopedTx, Array<() => void>> = new Map()
    private readonly joined: Map<EntityManager, Array<() => void>> = new Map()
    private next = 0
    private fails: (mutation: Mutation) => boolean = () => false

    constructor() {
        wireScope(this.engine)
        this.engine.get.mockImplementation((_tx, entity, id) => Promise.resolve(this.table(entity).get(id) ?? null))
        this.engine.list.mockImplementation((_tx, query) => Promise.resolve(this.list(query)))
        this.mutations.mutate.mockImplementation((tx, mutation) => Promise.resolve(this.logged(tx, mutation)))
    }

    /** The rows of one entity, in the order they were written. */
    rows(entity: string): ReadonlyArray<RecordRow> {
        return [...this.table(entity).values()]
    }

    /** Copies of the rows of a table whose members hold every value of `where`. */
    of(table: string, where: Readonly<Record<string, unknown>> = {}): ReadonlyArray<RecordRow> {
        return this.rows(table)
            .filter((row) => Object.entries(where).every(([name, value]) => row.data[name] === value))
            .map((row) => structuredClone(row))
    }

    /** A copy of one row of a table, or null. */
    get(table: string, id: string): RecordRow | null {
        const row = this.table(table).get(id)
        return row === undefined ? null : structuredClone(row)
    }

    /** Writes one mutation of a core table, in the transaction of `tx` when one is named (taken back with it), and fails as `failWhen` says. */
    write(mutation: Mutation, tx?: ScopedTx): EngineResult {
        if (this.fails(mutation)) throw new Error(`memory engine: ${mutation.op} failed`)
        return tx === undefined ? this.mutate(mutation) : this.logged(tx, mutation)
    }

    /** Removes one row of a table. */
    remove(table: string, id: string): void {
        this.table(table).delete(id)
    }

    /** Stores a row of a table under its id, as a first version (what an earlier write of the app left: a run its open wrote). */
    put(table: string, id: string, data: RecordRow["data"]): RecordRow {
        const row: RecordRow = { id, workspaceId: "ws-1", version: "1", createdAt: STAMP, updatedAt: STAMP, data: structuredClone(data) }
        this.table(table).set(id, row)
        return structuredClone(row)
    }

    /**
     * Makes each `scoped` call one transaction, as on the database: a scope of its own, and when its work throws, every row it wrote is
     * put back as it was. A nested `scoped` is a transaction of its own, so what it wrote stays when the outer one rolls back.
     */
    transactional(): this {
        this.engine.scoped.mockImplementation(async (workspaceId, work) => {
            const tx = mock<ScopedTx>({ workspaceId })
            const undo: Array<() => void> = []
            this.undo.set(tx, undo)
            try {
                return await work(tx)
            } catch (cause) {
                undo.toReversed().forEach((step) => step())
                throw cause
            } finally {
                this.undo.delete(tx)
            }
        })
        return this
    }

    /**
     * Opt-in, on top of `transactional`: makes `within` JOIN the transaction of the manager it is given, as on the database. What
     * the engine writes in it is kept per manager after the engine scope is left, so a failure later in that transaction (a row
     * written on the manager) takes it back with `rollBack(manager)`; `commit(manager)` forgets it once the transaction committed.
     */
    managed(): this {
        this.engine.within.mockImplementation(async (manager, workspaceId, work) => {
            const tx = mock<ScopedTx>({ workspaceId, manager })
            const undo = this.joined.get(manager) ?? []
            this.joined.set(manager, undo)
            this.undo.set(tx, undo)
            try {
                return await work(tx)
            } finally {
                this.undo.delete(tx)
            }
        })
        return this
    }

    /** Puts back, newest first, every row the engine wrote in the transaction of this manager (see `managed`). */
    rollBack(manager: EntityManager): void {
        const undo = this.joined.get(manager) ?? []
        this.joined.delete(manager)
        undo.toReversed().forEach((step) => step())
    }

    /** Keeps what the engine wrote in the transaction of this manager: it committed (see `managed`). */
    commit(manager: EntityManager): void {
        this.joined.delete(manager)
    }

    /** Makes the next writes that `fails` picks throw, as a lost connection would, until it answers false. */
    failWhen(fails: (mutation: Mutation) => boolean): void {
        this.fails = fails
        this.mutations.mutate.mockImplementation((tx, mutation) => {
            if (fails(mutation)) return Promise.reject(new Error(`memory engine: ${mutation.op} failed`))
            return Promise.resolve(this.logged(tx, mutation))
        })
    }

    /** A write, with how to undo it kept for the transaction it ran in. */
    private logged(tx: ScopedTx, mutation: Mutation): EngineResult {
        const entity = "entity" in mutation ? mutation.entity : ""
        const held = mutation.op === "update" ? this.table(entity).get(mutation.key) : undefined
        const result = this.mutate(mutation)
        const undo = this.undo.get(tx)
        if (undo === undefined || !result.ok) return result
        const { id } = result.row
        if (result.created === true) undo.push(() => this.table(entity).delete(id))
        else if (held !== undefined) undo.push(() => this.table(entity).set(id, held))
        return result
    }

    private list(query: Query): ListPage {
        const found = ordered(
            this.rows(query.from).filter((row) => matches(row, query.where)),
            query,
        )
        return pageOf(found.slice(0, query.page?.size ?? found.length))
    }

    private mutate(mutation: Mutation): EngineResult {
        if (mutation.op === "insert") return this.insert(mutation.entity, mutation.values)
        if (mutation.op === "update")
            return this.update(mutation.entity, mutation.key, mutation.expected, mutation.values)
        if (mutation.op === "ensure") return this.ensure(mutation.entity, mutation.match, mutation.values)
        return { ok: false, reason: "invalid" }
    }

    private insert(entity: string, values: MutationValues): EngineResult {
        const definition = CATALOG.get(entity)
        const data: Record<string, unknown> = {
            ...Object.fromEntries(
                Object.entries(definition?.fields ?? {}).map(([name, field]) => [name, defaultOf(field.default)]),
            ),
            ...values,
        }
        const taken = (definition?.constraints ?? []).find(
            (constraint) =>
                constraint.kind === "unique" &&
                this.rows(entity).some((row) => constraint.on.every((field) => row.data[field] === data[field])),
        )
        if (taken !== undefined) return { ok: false, reason: "taken", constraint: taken.name, refusal: "" }
        const keyed = (CORE_TABLE_KEYS[entity] ?? []).some((key) => this.rows(entity).some((row) => keyTaken(row.data, values, key)))
        if (keyed) return { ok: false, reason: "taken", constraint: `${entity}:unique`, refusal: "" }
        this.next += 1
        const row: RecordRow = {
            id: `${entity.split(".").at(-1) ?? "row"}-${this.next}`,
            workspaceId: "ws-1",
            version: "1",
            createdAt: STAMP,
            updatedAt: STAMP,
            data,
        }
        this.table(entity).set(row.id, row)
        return { ok: true, row, version: row.version, created: true }
    }

    private update(entity: string, key: string, expected: string, values: MutationValues): EngineResult {
        const held = this.table(entity).get(key)
        if (held === undefined) return { ok: false, reason: "missing" }
        if (held.version !== expected) return { ok: false, reason: "stale" }
        const row: RecordRow = { ...held, version: String(Number(held.version) + 1), data: { ...held.data, ...values } }
        this.table(entity).set(key, row)
        return { ok: true, row, version: row.version, created: false }
    }

    private ensure(entity: string, match: string, values: MutationValues): EngineResult {
        const fields = CATALOG.get(entity)?.matchKeys?.find((key) => key.name === match)?.on ?? []
        const found = this.rows(entity).find((row) => fields.every((field) => row.data[field] === values[field]))
        return found === undefined
            ? this.insert(entity, values)
            : { ok: true, row: found, version: found.version, created: false }
    }

    private table(entity: string): Map<string, RecordRow> {
        const found = this.tables.get(entity)
        if (found !== undefined) return found
        const made = new Map<string, RecordRow>()
        this.tables.set(entity, made)
        return made
    }
}

/** The state of an agent graph as the graph store answers it. */
type AgentGraphState = NonNullable<Awaited<ReturnType<AgentGraphsService["stateOfAgent"]>>>

/** The state of an agent graph whose version `versionId` decides with this flow. */
export const graphStateOf = (versionId: string, flow: GraphSpec, agentId = "agent-1"): AgentGraphState => ({
    workspaceId: "ws-1",
    agentId,
    installationId: "inst-1",
    mode: "enforced",
    draft: { nodes: [], flow },
    draftRev: 1,
    activeVersionId: versionId,
    active: { nodes: [], flow },
    activeKind: "spec",
})

/** One agent graph version as the graph store lists it. */
export const graphVersionOf = (id: string, version: number): GraphVersionView => ({
    id,
    version,
    changeKind: "spec",
    note: "",
    publishedAt: "2026-11-08T02:00:00.000Z",
    publishedBy: null,
})

/** Wires the graph store double: the shop graph decides as version 1, and each publish becomes the next version that decides. */
const wireGraphs = (graphs: ReturnType<typeof mock<AgentGraphsService>>, shop: GraphSpec): void => {
    graphs.stateOfAgent.mockResolvedValue(graphStateOf("graph-v1", shop))
    graphs.stateOfAgentIn.mockImplementation((tx, agentId) => graphs.stateOfAgent(tx.workspaceId, agentId))
    graphs.publishIn.mockImplementation((_tx, input) => graphs.publish(input))
    graphs.versionsOf.mockResolvedValue([graphVersionOf("graph-v1", 1)])
    graphs.documentOf.mockResolvedValue({ nodes: [], flow: shop })
    let published = 1
    graphs.publish.mockImplementation((input) => {
        published += 1
        const flow = input.document.flow ?? shop
        graphs.stateOfAgent.mockResolvedValue(graphStateOf(`graph-v${published}`, flow, input.agentId))
        return Promise.resolve(graphVersionOf(`graph-v${published}`, published))
    })
}

/** The core tables of the graphs, workflows and runs on the memory engine: the stores the records services are built on. */
export const coreTablesOf = (memory: MemoryEngine): ReadonlyArray<Provider> => [
    { provide: AGENT_GRAPH_STORE, useValue: memoryGraphStore(memory) },
    { provide: AGENT_WORKFLOW_STORE, useValue: memoryWorkflowStore(memory) },
    { provide: AgentRunRecordsService, useValue: new AgentRunRecordsService(memoryRunStore(memory, () => STAMP)) },
]

/** The doubles the workflow services are built on, and the providers that bind them beside the services under test. */
export interface WorkflowDoubles {
    readonly providers: ReadonlyArray<Provider>
    readonly memory: MemoryEngine
    readonly graphs: ReturnType<typeof mock<AgentGraphsService>>
    readonly installations: ReturnType<typeof mock<InstallationRecordsService>>
    readonly logger: ReturnType<typeof mock<Logger>>
}

/**
 * The doubles of the workflow services: a memory engine, a graph store whose shop graph decides (the invoice template unless one is given),
 * the installations inst-1 (agent-1) and any other (agent-2) of the `webbooks` module, and a logger; the services under test are listed first in the providers.
 */
export const workflowDoubles = (services: ReadonlyArray<Type>, shop: GraphSpec = shopAccountingGraph()): WorkflowDoubles => {
    const memory = new MemoryEngine()
    const graphs = mock<AgentGraphsService>()
    wireGraphs(graphs, shop)
    const installations = mock<InstallationRecordsService>()
    installations.find.mockImplementation((_workspaceId, id) =>
        Promise.resolve(
            mock<InstallationRecord>({ id, agentId: id === "inst-1" ? "agent-1" : "agent-2", moduleKey: "webbooks" }),
        ),
    )
    const logger = mock<Logger>()
    return {
        providers: [
            ...services,
            { provide: EntityEngineService, useValue: memory.engine },
            { provide: EntityMutationService, useValue: memory.mutations },
            ...coreTablesOf(memory),
            { provide: AgentGraphsService, useValue: graphs },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: LOGGER, useValue: logger },
        ],
        memory,
        graphs,
        installations,
        logger,
    }
}

/** The doubles of the workflow services over the REAL graph store: both on one transactional memory engine. */
export interface StoreDoubles {
    readonly providers: ReadonlyArray<Provider>
    readonly memory: MemoryEngine
    readonly logger: ReturnType<typeof mock<Logger>>
}

/**
 * The doubles of the workflow services with the agent graph store itself (`AgentGraphsService` and its records, to be listed in
 * `services`) on a transactional memory engine, so a spec sees what one transaction commits and what a failure rolls back.
 */
export const storeDoubles = (services: ReadonlyArray<Type>): StoreDoubles => {
    const memory = new MemoryEngine().transactional()
    const installations = mock<InstallationRecordsService>()
    installations.find.mockImplementation((_workspaceId, id) =>
        Promise.resolve(
            mock<InstallationRecord>({ id, agentId: id === "inst-1" ? "agent-1" : "agent-2", moduleKey: "webbooks" }),
        ),
    )
    const logger = mock<Logger>()
    return {
        providers: [
            ...services,
            { provide: EntityEngineService, useValue: memory.engine },
            { provide: EntityMutationService, useValue: memory.mutations },
            ...coreTablesOf(memory),
            { provide: InstallationRecordsService, useValue: installations },
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: new FakeClock(STAMP) },
        ],
        memory,
        logger,
    }
}
