import type { Provider, Type } from "@nestjs/common"
import { FakeClock, mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { AnyEntityDefinition, FieldDefault } from "@nivo-lite/agent-sdk/entity"
import type { EngineResult, ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Mutation, MutationValues } from "@nivo-lite/agent-sdk/mutation"
import type { FilterExpr, Query } from "@nivo-lite/agent-sdk/query"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import { latestTemplateVersion, workflowTemplateOf } from "@nivo-lite/blocks-core/modules"
import { AgentGraphsService } from "@modules/domain/agent-graphs"
import type { GraphVersionView } from "@modules/domain/agent-graphs"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { pageOf, wireScope } from "./agent-graph-records.builder"

/** The time every row of the memory engine is stamped with. */
const STAMP = "2026-11-09T02:00:00.000Z"

/** The empty graph of a template that is not there; the specs only read templates that are. */
const NO_GRAPH: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "none",
    trigger: { kind: "tag", sources: [] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [],
}

/** The graph of a shipped template: that of its newest version (every shipped template holds one version). */
export const templateGraph = (id: string): GraphSpec => {
    const template = workflowTemplateOf(id)
    return template === null ? NO_GRAPH : latestTemplateVersion(template).graph
}

/** The number of the newest version of a shipped template; 0 for a template that is not there. */
export const templateNewest = (id: string): number => {
    const template = workflowTemplateOf(id)
    return template === null ? 0 : latestTemplateVersion(template).version
}

/** The group the owner's one change puts the last step of a graph in. */
export const SHOP_GROUP = "shop"

/** A graph with the owner's one change: its LAST step moved to the group `SHOP_GROUP`. One step differs, and the graph runs the same. */
export const ownerEdited = (graph: GraphSpec): GraphSpec => ({
    ...graph,
    nodes: graph.nodes.map((node, at) => (at === graph.nodes.length - 1 ? { ...node, group: SHOP_GROUP } : node)),
})

/** The accounting graph the demo shop runs: the reconcile template as shipped, with the owner's one change. */
export const shopAccountingGraph = (): GraphSpec => ownerEdited(templateGraph("accounting.reconcile"))

const CATALOG: ReadonlyMap<string, AnyEntityDefinition> = new Map(
    FLOW_F_ENTITIES.map((entity) => [entity.name, entity]),
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
 * the field defaults of the blocks-core entity declarations. The double of the engine and of the mutation port for a store's specs.
 */
export class MemoryEngine {
    readonly engine: ReturnType<typeof mock<EntityEngineService>> = mock<EntityEngineService>()
    readonly mutations: ReturnType<typeof mock<EntityMutationService>> = mock<EntityMutationService>()
    private readonly tables: Map<string, Map<string, RecordRow>> = new Map()
    private readonly undo: Map<ScopedTx, Array<() => void>> = new Map()
    private next = 0

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

    /** Makes the next writes that `fails` picks throw, as a lost connection would, until it answers false. */
    failWhen(fails: (mutation: Mutation) => boolean): void {
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
    draft: { nodes: [], rights: [], flow },
    draftRev: 1,
    activeVersionId: versionId,
    active: { nodes: [], rights: [], flow },
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
const wireGraphs = (graphs: ReturnType<typeof mock<AgentGraphsService>>): void => {
    graphs.stateOfAgent.mockResolvedValue(graphStateOf("graph-v1", shopAccountingGraph()))
    graphs.stateOfAgentIn.mockImplementation((tx, agentId) => graphs.stateOfAgent(tx.workspaceId, agentId))
    graphs.publishIn.mockImplementation((_tx, input) => graphs.publish(input))
    graphs.versionsOf.mockResolvedValue([graphVersionOf("graph-v1", 1)])
    graphs.documentOf.mockResolvedValue({ nodes: [], rights: [], flow: shopAccountingGraph() })
    let published = 1
    graphs.publish.mockImplementation((input) => {
        published += 1
        const flow = input.document.flow ?? shopAccountingGraph()
        graphs.stateOfAgent.mockResolvedValue(graphStateOf(`graph-v${published}`, flow, input.agentId))
        return Promise.resolve(graphVersionOf(`graph-v${published}`, published))
    })
}

/** The doubles the workflow services are built on, and the providers that bind them beside the services under test. */
export interface WorkflowDoubles {
    readonly providers: ReadonlyArray<Provider>
    readonly memory: MemoryEngine
    readonly graphs: ReturnType<typeof mock<AgentGraphsService>>
    readonly installations: ReturnType<typeof mock<InstallationRecordsService>>
    readonly logger: ReturnType<typeof mock<Logger>>
}

/**
 * The doubles of the workflow services: a memory engine, a graph store whose shop graph decides, the installations inst-1 (agent-1)
 * and any other (agent-2) of the accounting module, and a logger; the services under test are listed first in the providers.
 */
export const workflowDoubles = (services: ReadonlyArray<Type>): WorkflowDoubles => {
    const memory = new MemoryEngine()
    const graphs = mock<AgentGraphsService>()
    wireGraphs(graphs)
    const installations = mock<InstallationRecordsService>()
    installations.find.mockImplementation((_workspaceId, id) =>
        Promise.resolve(
            mock<InstallationRecord>({ id, agentId: id === "inst-1" ? "agent-1" : "agent-2", moduleKey: "accounting" }),
        ),
    )
    const logger = mock<Logger>()
    return {
        providers: [
            ...services,
            { provide: EntityEngineService, useValue: memory.engine },
            { provide: EntityMutationService, useValue: memory.mutations },
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
            mock<InstallationRecord>({ id, agentId: id === "inst-1" ? "agent-1" : "agent-2", moduleKey: "accounting" }),
        ),
    )
    const logger = mock<Logger>()
    return {
        providers: [
            ...services,
            { provide: EntityEngineService, useValue: memory.engine },
            { provide: EntityMutationService, useValue: memory.mutations },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: new FakeClock(STAMP) },
        ],
        memory,
        logger,
    }
}
