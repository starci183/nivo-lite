import type { EngineResult, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Mutation, MutationValues } from "@nivo-lite/agent-sdk/mutation"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type { AgentGraphStore, GraphLookup } from "@modules/domain/agent-graphs/agent-graph-store.port"
import {
    graphRecordOf,
    proposalRecordOf,
    sourceRecordOf,
    versionRecordOf,
} from "@modules/domain/agent-graphs/agent-graphs.mapper"
import type { ProposalStatusFilter } from "@modules/domain/agent-graphs/agent-graphs-records.contracts"
import type { AgentWorkflowTableStore } from "@modules/domain/agent-graphs/agent-workflow-store.port"
import { workflowRecordOf, workflowVersionRecordOf } from "@modules/domain/agent-graphs/agent-workflows.mapper"
import type { AgentRunTableStore } from "@modules/domain/agent-runs/agent-run-table-store.port"
import { reportedStatusOf } from "@modules/domain/agent-runs/policies/agent-runs.policy"
import type {
    RunCount,
    RunCountFilter,
    RunListFilter,
    RunWindow,
    StepCounts,
    StoredRun,
    StoredStep,
    StoredWaiter,
} from "@modules/domain/agent-runs/agent-runs-rows.contracts"
import type { NodeEffectStore, StoredEffect } from "@modules/domain/graph-nodes/node-effect-store.port"

// THE ENGINE'S CORE TABLES OF THE RUNS AND GRAPHS IN MEMORY: the doubles of the stores of the graphs, workflows, runs, steps and the
// effect ledger, for the unit specs and the thread worlds. Each store keeps the rows its table keeps on a `TableRows` (a world's one
// database, or `MemoryTables` for a unit spec) under the TABLE name, every write through its mutation path, with the unique keys the
// table declares (a null member keys nothing), the defaults it fills and a version that moves on every write. A double changes only HOW
// it stores, never what it answers.

/** The rows of the tables the doubles keep: what a world's database and `MemoryTables` both offer. */
export interface TableRows {
    /** Copies of the rows of a table whose members hold every value of `where`. */
    of(table: string, where?: Readonly<Record<string, unknown>>): ReadonlyArray<RecordRow>
    /** A copy of one row, or null. */
    get(table: string, id: string): RecordRow | null
    /** Writes one mutation (insert, update) under the table's unique keys and versions, in the transaction of `tx` when one is named. */
    write(mutation: Mutation, tx?: ScopedTx): EngineResult
    /** Removes one row. */
    remove(table: string, id: string): void
}

/** The tables, by name. */
export const AGENT_GRAPHS = "agent_graphs"
export const AGENT_GRAPH_VERSIONS = "agent_graph_versions"
export const AGENT_GRAPH_SOURCES = "agent_graph_sources"
export const AGENT_GRAPH_PROPOSALS = "agent_graph_proposals"
export const AGENT_WORKFLOWS = "agent_workflows"
export const AGENT_WORKFLOW_VERSIONS = "agent_workflow_versions"
export const AGENT_RUNS = "agent_runs"
export const AGENT_RUN_STEPS = "agent_run_steps"
export const AGENT_NODE_EFFECTS = "agent_node_effects"

/** The unique keys of the tables, as their migration declares them (each within the workspace). */
export const CORE_TABLE_KEYS: Readonly<Record<string, ReadonlyArray<ReadonlyArray<string>>>> = {
    [AGENT_GRAPHS]: [["agentId"]],
    [AGENT_GRAPH_VERSIONS]: [["agentId", "number"]],
    [AGENT_GRAPH_SOURCES]: [["versionId", "nodeKey", "branchKey", "kind", "ref"]],
    [AGENT_GRAPH_PROPOSALS]: [["agentId", "dedupeKey"]],
    [AGENT_WORKFLOWS]: [["agentId", "key"]],
    [AGENT_WORKFLOW_VERSIONS]: [["workflowId", "number"]],
    [AGENT_RUNS]: [["wakeId", "planning"]],
    [AGENT_RUN_STEPS]: [["runId", "stepKey"]],
    [AGENT_NODE_EFFECTS]: [["effectKey"]],
}

/** True when a row holds the values of one key of a write (a key with a null or absent member keys nothing). */
export const keyTaken = (data: RecordRow["data"], values: MutationValues, key: ReadonlyArray<string>): boolean =>
    key.every((field) => values[field] !== null && values[field] !== undefined) &&
    key.every((field) => JSON.stringify(data[field]) === JSON.stringify(values[field]))

/** The instant every row of `MemoryTables` is stamped with when none is given. */
const STAMP = "2026-11-10T10:00:00.000Z"

/** Tables in memory for a unit spec: rows by table, ids `<table>-<n>`, a version per write, the unique keys of `CORE_TABLE_KEYS`. */
export class MemoryTables implements TableRows {
    /** Every row, by id, with its table. */
    readonly rows: Map<string, { readonly table: string; row: RecordRow }> = new Map()

    /** Every write, in order. */
    readonly writes: Array<Mutation> = []

    private next = 0

    constructor(private readonly stamp: () => string = () => STAMP) {}

    /** Stores a row under its id as a first version (a spec's fixture). */
    put(table: string, id: string, data: RecordRow["data"]): RecordRow {
        const at = this.stamp()
        const row: RecordRow = { id, workspaceId: "ws-1", version: "1", createdAt: at, updatedAt: at, data: structuredClone(data) }
        this.rows.set(id, { table, row })
        return structuredClone(row)
    }

    of(table: string, where: Readonly<Record<string, unknown>> = {}): ReadonlyArray<RecordRow> {
        return [...this.rows.values()]
            .filter((held) => held.table === table)
            .map((held) => held.row)
            .filter((row) => Object.entries(where).every(([name, value]) => row.data[name] === value))
            .map((row) => structuredClone(row))
    }

    get(table: string, id: string): RecordRow | null {
        const held = this.rows.get(id)
        return held?.table === table ? structuredClone(held.row) : null
    }

    write(mutation: Mutation): EngineResult {
        this.writes.push(structuredClone(mutation))
        if (mutation.op === "insert") {
            const keys = CORE_TABLE_KEYS[mutation.entity] ?? []
            const taken = this.of(mutation.entity).some((row) => keys.some((key) => keyTaken(row.data, mutation.values, key)))
            if (taken) return { ok: false, reason: "taken", constraint: `${mutation.entity}:unique`, refusal: `${mutation.entity}-taken` }
            this.next += 1
            const row = this.put(mutation.entity, `${mutation.entity}-${String(this.next)}`, mutation.values)
            return { ok: true, row, version: "1", created: true }
        }
        if (mutation.op !== "update") return { ok: false, reason: "invalid" }
        const held = this.rows.get(mutation.key)
        if (held?.table !== mutation.entity) return { ok: false, reason: "missing" }
        if (mutation.expected !== held.row.version) return { ok: false, reason: "stale" }
        const version = String(Number(held.row.version) + 1)
        held.row = { ...held.row, version, updatedAt: this.stamp(), data: { ...held.row.data, ...structuredClone(mutation.values) } }
        return { ok: true, row: structuredClone(held.row), version }
    }

    remove(table: string, id: string): void {
        if (this.rows.get(id)?.table === table) this.rows.delete(id)
    }
}

/** A JSON copy of a store's values, as a row keeps them (an absent member left out). */
const valuesOf = (values: object): MutationValues =>
    structuredClone(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))) as MutationValues

/** The written row of a mutation, or null when a key or a fence refused it. */
const writtenOf = (rows: TableRows, mutation: Mutation, tx?: ScopedTx): RecordRow | null => {
    const result = rows.write(mutation, tx)
    return result.ok ? result.row : null
}

/** A stored row with its members, its head and its fence, as a TypeORM entity of the table would hold it. */
export const entityOf = (row: RecordRow): Readonly<Record<string, unknown>> => ({
    ...row.data,
    id: row.id,
    workspaceId: row.workspaceId,
    version: Number(row.version),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
})

const byText = (left: string, right: string): number => {
    if (left < right) return -1
    return left > right ? 1 : 0
}

const textOf = (value: unknown): string => {
    if (typeof value === "string") return value
    return value === null || value === undefined ? "" : JSON.stringify(value)
}

/** One member of a row: the three row columns by name, anything else out of its data. */
const memberOf = (row: RecordRow, member: string): unknown => {
    if (member === "id") return row.id
    if (member === "createdAt") return row.createdAt
    return member === "updatedAt" ? row.updatedAt : row.data[member]
}

/** Rows sorted by members (a member `desc` reversed), as a table's index orders them. */
const sorted = (rows: ReadonlyArray<RecordRow>, order: ReadonlyArray<readonly [string, "asc" | "desc"]>): ReadonlyArray<RecordRow> =>
    rows.toSorted((left, right) => {
        for (const [member, direction] of order) {
            const [a, b] = [memberOf(left, member), memberOf(right, member)]
            const compared = typeof a === "number" && typeof b === "number" ? a - b : byText(textOf(a), textOf(b))
            if (compared !== 0) return direction === "desc" ? -compared : compared
        }
        return 0
    })

/** Writes the row of a key when the table holds none, and answers the row that stands (this call's or the one already there). */
const ensured = (
    rows: TableRows,
    table: string,
    values: MutationValues,
    tx: ScopedTx,
): { readonly row: RecordRow; readonly created: boolean } => {
    const written = writtenOf(rows, { op: "insert", entity: table, values }, tx)
    if (written !== null) return { row: written, created: true }
    const keys = CORE_TABLE_KEYS[table] ?? []
    const held = rows.of(table).find((row) => keys.some((key) => keyTaken(row.data, values, key)))
    if (held === undefined) throw new TypeError(`${table}: the row of the key is gone`)
    return { row: held, created: false }
}

/** The graph store on a table double. */
export const memoryGraphStore = (rows: TableRows): AgentGraphStore => ({
    graph: (_tx, lookup: GraphLookup) => {
        const found = sorted(rows.of(AGENT_GRAPHS, { ...lookup }), [["id", "asc"]]).at(0)
        return Promise.resolve(found === undefined ? null : graphRecordOf(entityOf(found)))
    },
    graphs: (_tx, agentIds, limit) => {
        const held = rows.of(AGENT_GRAPHS).filter((row) => agentIds === null || agentIds.includes(String(row.data.agentId)))
        return Promise.resolve(sorted(held, [["agentId", "asc"], ["id", "asc"]]).slice(0, limit).map((row) => graphRecordOf(entityOf(row))))
    },
    ensureGraph: (tx, graph) => {
        const { row, created } = ensured(rows, AGENT_GRAPHS, valuesOf({ ...graph, activeVersionId: null, modeSetBy: null, modeSetAt: null }), tx)
        return Promise.resolve({ graph: graphRecordOf(entityOf(row)), created })
    },
    patchGraph: (tx, id, fence, patch) => {
        const row = writtenOf(rows, { op: "update", entity: AGENT_GRAPHS, key: id, expected: fence, values: valuesOf(patch) }, tx)
        return Promise.resolve(row === null ? null : graphRecordOf(entityOf(row)))
    },
    version: (_tx, id) => {
        const row = rows.get(AGENT_GRAPH_VERSIONS, id)
        return Promise.resolve(row === null ? null : versionRecordOf(entityOf(row)))
    },
    versions: (_tx, agentId, limit) =>
        Promise.resolve(
            sorted(rows.of(AGENT_GRAPH_VERSIONS, { agentId }), [["number", "desc"], ["id", "desc"]])
                .slice(0, limit)
                .map((row) => versionRecordOf(entityOf(row))),
        ),
    addVersion: (tx, version) => {
        const row = writtenOf(rows, {
            op: "insert",
            entity: AGENT_GRAPH_VERSIONS,
            values: valuesOf({ ...version, publishedAt: version.publishedAt ?? STAMP }),
        }, tx)
        return Promise.resolve(row === null ? null : versionRecordOf(entityOf(row)))
    },
    insertSource: (tx, source) =>
        Promise.resolve(writtenOf(rows, { op: "insert", entity: AGENT_GRAPH_SOURCES, values: valuesOf(source) }, tx) !== null),
    sources: (_tx, kind, versionIds, limit) =>
        Promise.resolve(
            sorted(
                rows.of(AGENT_GRAPH_SOURCES, { kind }).filter((row) => versionIds.includes(String(row.data.versionId))),
                [["versionId", "asc"], ["id", "asc"]],
            )
                .slice(0, limit)
                .map((row) => sourceRecordOf(entityOf(row))),
        ),
    proposal: (_tx, id) => {
        const row = rows.get(AGENT_GRAPH_PROPOSALS, id)
        return Promise.resolve(row === null ? null : proposalRecordOf(entityOf(row)))
    },
    proposals: (_tx, filter: ProposalStatusFilter, limit) => {
        const statuses: ReadonlyArray<unknown> = filter.statuses
        const held = rows
            .of(AGENT_GRAPH_PROPOSALS, { agentId: filter.agentId, ...(filter.kind === undefined ? {} : { kind: filter.kind }) })
            .filter((row) => statuses.includes(row.data.status))
        const order: ReadonlyArray<readonly [string, "asc" | "desc"]> = filter.byStatus
            ? [["status", "asc"], ["id", "asc"]]
            : [["createdAt", "desc"], ["id", "desc"]]
        return Promise.resolve(sorted(held, order).slice(0, limit).map((row) => proposalRecordOf(entityOf(row))))
    },
    raiseProposal: (tx, proposal) =>
        Promise.resolve(
            writtenOf(rows, {
                op: "insert",
                entity: AGENT_GRAPH_PROPOSALS,
                values: valuesOf({ ...proposal, status: "open", decidedBy: null, decidedAt: null, resultVersionId: null }),
            }, tx) !== null,
        ),
    patchProposal: (tx, id, fence, patch) => {
        const row = writtenOf(rows, { op: "update", entity: AGENT_GRAPH_PROPOSALS, key: id, expected: fence, values: valuesOf(patch) }, tx)
        return Promise.resolve(row === null ? null : proposalRecordOf(entityOf(row)))
    },
})

/** The workflow store on a table double. */
export const memoryWorkflowStore = (rows: TableRows): AgentWorkflowTableStore => ({
    workflow: (_tx, id) => {
        const row = rows.get(AGENT_WORKFLOWS, id)
        return Promise.resolve(row === null ? null : workflowRecordOf(entityOf(row)))
    },
    workflows: (_tx, agentId, limit) =>
        Promise.resolve(
            sorted(rows.of(AGENT_WORKFLOWS, agentId === null ? {} : { agentId }), [["agentId", "asc"], ["position", "asc"], ["id", "asc"]])
                .slice(0, limit)
                .map((row) => workflowRecordOf(entityOf(row))),
        ),
    insertWorkflow: (tx, workflow) => {
        const row = writtenOf(rows, { op: "insert", entity: AGENT_WORKFLOWS, values: valuesOf(workflow) }, tx)
        return Promise.resolve(row === null ? null : workflowRecordOf(entityOf(row)))
    },
    updateWorkflow: (tx, id, fence, patch) => {
        const row = writtenOf(rows, { op: "update", entity: AGENT_WORKFLOWS, key: id, expected: fence, values: valuesOf(patch) }, tx)
        return Promise.resolve(row === null ? null : workflowRecordOf(entityOf(row)))
    },
    version: (_tx, id) => {
        const row = rows.get(AGENT_WORKFLOW_VERSIONS, id)
        return Promise.resolve(row === null ? null : workflowVersionRecordOf(entityOf(row)))
    },
    versions: (_tx, workflowId, limit) =>
        Promise.resolve(
            sorted(rows.of(AGENT_WORKFLOW_VERSIONS, { workflowId }), [["number", "desc"], ["id", "desc"]])
                .slice(0, limit)
                .map((row) => workflowVersionRecordOf(entityOf(row))),
        ),
    versionOfGraphVersion: (_tx, agentId, graphVersionId) => {
        const found = sorted(rows.of(AGENT_WORKFLOW_VERSIONS, { agentId, graphVersionId }), [["id", "asc"]]).at(0)
        return Promise.resolve(found === undefined ? null : workflowVersionRecordOf(entityOf(found)))
    },
    addVersion: (tx, version) => {
        const row = writtenOf(rows, {
            op: "insert",
            entity: AGENT_WORKFLOW_VERSIONS,
            values: valuesOf({ ...version, publishedAt: version.publishedAt ?? STAMP }),
        }, tx)
        return Promise.resolve(row === null ? null : workflowVersionRecordOf(entityOf(row)))
    },
})

/** The defaults a run row is filled with, as the table declares them. */
export const RUN_DEFAULTS: Omit<StoredRun, "id" | "workspaceId" | "version" | "createdAt" | "updatedAt" | "agentId" | "wakeId" | "trigger" | "graphVersionId" | "context" | "startedAt"> = {
    planning: false,
    status: "running",
    engine: "langgraph",
    error: null,
    deadLetteredAt: null,
    parkedBuild: null,
    parkReason: null,
    resumeAttempts: 0,
    resumeNotBefore: null,
    resumedAt: null,
    resumedBy: null,
    resumeReason: null,
    waitWorkItemId: null,
    waitDeadlineAt: null,
    stepSeq: 0,
    endedAt: null,
    cancelledAt: null,
    cancelledBy: null,
    workflowId: null,
    workflowVersionId: null,
    workflowVersion: null,
}

/** The defaults a step row is filled with, as the table declares them. */
export const STEP_DEFAULTS: Omit<StoredStep, "id" | "workspaceId" | "version" | "createdAt" | "updatedAt" | "runId" | "ordinal" | "stepKey" | "nodeKey" | "kind" | "effect" | "input"> = {
    result: null,
    status: "pending",
    attempt: 0,
    maxAttempts: 3,
    deadlineMs: null,
    notBefore: null,
    waitItemId: null,
    workItemId: null,
    errorCode: null,
    claimedUntil: null,
    startedAt: null,
    endedAt: null,
    durationMs: null,
    doorCalls: { calls: [] },
    effectKey: null,
    error: null,
}

/** A stored run as the store hands it out. */
export const storedRunOfRow = (row: RecordRow): StoredRun => ({
    ...(structuredClone(row.data) as unknown as StoredRun),
    id: row.id,
    workspaceId: row.workspaceId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
})

/** A stored step as the store hands it out. */
export const storedStepOfRow = (row: RecordRow): StoredStep => ({
    ...(structuredClone(row.data) as unknown as StoredStep),
    id: row.id,
    workspaceId: row.workspaceId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
})

const inWindow = (at: string | null, window: RunWindow | undefined): boolean =>
    window === undefined || (at !== null && at >= window.from && at < window.to)

/** True for a run row that carries a wait mark (`wait_match` set). */
const waitMarkedRow = (row: RecordRow): boolean => Array.isArray(row.data.waitMatch) && row.data.waitMatch.length > 0

const listedRuns = (rows: TableRows, filter: RunListFilter): ReadonlyArray<StoredRun> => {
    const { subject } = filter
    const held = rows
        .of(AGENT_RUNS)
        // The subject index: the exact (kind, id) the run was opened with (columns `subject_kind`, `subject_id`).
        .filter((row) => subject === undefined || (row.data.subjectKind === subject.kind && row.data.subjectId === subject.id))
        .filter((row) => filter.waitMarked !== true || waitMarkedRow(row))
        // The REPORTED status (`reportedStatusOf`): a `running` run with a wait mark reads `waiting`.
        .filter((row) => filter.reported === undefined || filter.reported.includes(reportedStatusOf(String(row.data.status), waitMarkedRow(row))))
        .map((row) => storedRunOfRow(row))
        .filter(
            (run) =>
                (filter.agentId === undefined || run.agentId === filter.agentId) &&
                (filter.ids === undefined || filter.ids.includes(run.id)) &&
                (filter.statuses === undefined || filter.statuses.includes(run.status)) &&
                (filter.engine === undefined || run.engine === filter.engine) &&
                (filter.workflowId === undefined || run.workflowId === filter.workflowId),
        )
    const key = (run: StoredRun): string => {
        if (filter.order === "started") return run.startedAt
        return filter.order === "ended" ? (run.endedAt ?? "") : (run.resumeNotBefore ?? "")
    }
    return held.toSorted((left, right) => {
        const compared = byText(key(left), key(right)) || byText(left.id, right.id)
        return filter.order === "resume" ? compared : -compared
    })
}

/** The run and step store on a table double; `now` stamps a run that names no start. */
export const memoryRunStore = (rows: TableRows, now: () => string = () => STAMP): AgentRunTableStore => ({
    run: (_tx, id) => {
        const row = rows.get(AGENT_RUNS, id)
        return Promise.resolve(row === null ? null : storedRunOfRow(row))
    },
    runOfWake: (_tx, wakeId) =>
        Promise.resolve(sorted(rows.of(AGENT_RUNS, { wakeId }), [["id", "asc"]]).map((row) => storedRunOfRow(row)).at(0) ?? null),
    runs: (_tx, filter, limit) => {
        const skip = filter.skip ?? 0
        return Promise.resolve(listedRuns(rows, filter).slice(skip, skip + limit))
    },
    counts: (_tx, filter: RunCountFilter) => {
        const groups = new Map<string, RunCount>()
        for (const run of rows.of(AGENT_RUNS).filter((row) => filter.waitMarked !== true || waitMarkedRow(row)).map((row) => storedRunOfRow(row))) {
            const kept =
                (filter.agentId === undefined || run.agentId === filter.agentId) &&
                (filter.statuses === undefined || filter.statuses.includes(run.status)) &&
                inWindow(run.startedAt, filter.started) &&
                inWindow(run.endedAt, filter.ended)
            if (!kept) continue
            const key = `${run.agentId}:${run.status}`
            const held = groups.get(key)
            groups.set(key, { agentId: run.agentId, status: run.status, count: (held?.count ?? 0) + 1 })
        }
        return Promise.resolve([...groups.values()])
    },
    insertRun: (tx, run) => {
        const row = writtenOf(rows, {
            op: "insert",
            entity: AGENT_RUNS,
            values: valuesOf({ ...RUN_DEFAULTS, startedAt: now(), ...run }),
        }, tx)
        return Promise.resolve(row === null ? null : storedRunOfRow(row))
    },
    patchRun: (tx, id, fence, values) => {
        const row = writtenOf(rows, { op: "update", entity: AGENT_RUNS, key: id, expected: fence, values: valuesOf(values) }, tx)
        return Promise.resolve(row === null ? null : storedRunOfRow(row))
    },
    // The wait a run is parked on: its lookup keys and since when (columns `wait_match`, `wait_since`), written only by the step that parks
    // or resumes it. The table moves no fence for it; the double's one write moves its version, which a fenced write reads again.
    markWait: (tx, id, mark) => {
        const held = rows.get(AGENT_RUNS, id)
        if (held === null) return Promise.resolve()
        const values = mark === null || mark.match.length === 0 ? { waitMatch: null, waitSince: null } : { waitMatch: [...mark.match], waitSince: mark.since }
        writtenOf(rows, { op: "update", entity: AGENT_RUNS, key: id, expected: held.version, values: valuesOf(values) }, tx)
        return Promise.resolve()
    },
    // Every run one event is asked of, as the table's GIN overlap and `strpos` clause read them: a run holding one of the exact keys, or one
    // of the `contains` markers whose part (the key after the probe's prefix) lies in the event's text of that prefix.
    waiters: (_tx, filter) => {
        const found = rows
            .of(AGENT_RUNS)
            .filter((row) => {
                const kept = filter.agentIds.includes(String(row.data.agentId)) && filter.statuses.includes(String(row.data.status)) && row.data.engine === filter.engine
                const held: unknown = row.data.waitMatch
                if (!kept || !Array.isArray(held)) return false
                const keys: ReadonlyArray<string> = held.map((key: unknown) => String(key))
                if (keys.some((key) => filter.exact.includes(key))) return true
                if (!keys.some((key) => filter.markers.includes(key))) return false
                return keys.some((key) =>
                    Object.entries(filter.texts).some(([prefix, body]) => key.startsWith(prefix) && body.includes(key.slice(prefix.length))),
                )
            })
            .map((row): StoredWaiter => ({ id: row.id, agentId: String(row.data.agentId), context: structuredClone(storedRunOfRow(row).context), waitSince: typeof row.data.waitSince === "string" ? row.data.waitSince : null }))
        return Promise.resolve(found)
    },
    pinRun: (tx, id, pin) => {
        const held = rows.get(AGENT_RUNS, id)
        if (held === null || (held.data.workflowId !== null && held.data.workflowId !== undefined)) return Promise.resolve(false)
        return Promise.resolve(
            writtenOf(rows, { op: "update", entity: AGENT_RUNS, key: id, expected: held.version, values: valuesOf(pin) }, tx) !== null,
        )
    },
    steps: (_tx, runId, limit) =>
        Promise.resolve(sorted(rows.of(AGENT_RUN_STEPS, { runId }), [["ordinal", "asc"], ["id", "asc"]]).slice(0, limit).map((row) => storedStepOfRow(row))),
    insertStep: (tx, step) => {
        const row = writtenOf(rows, { op: "insert", entity: AGENT_RUN_STEPS, values: valuesOf({ ...STEP_DEFAULTS, ...step }) }, tx)
        return Promise.resolve(row === null ? null : storedStepOfRow(row))
    },
    patchStep: (tx, id, fence, values) => {
        const row = writtenOf(rows, { op: "update", entity: AGENT_RUN_STEPS, key: id, expected: fence, values: valuesOf(values) }, tx)
        return Promise.resolve(row === null ? null : storedStepOfRow(row))
    },
    stepCounts: (_tx, runIds) => {
        const counts = new Map<string, { total: number; done: number; begun: number; failed: number }>()
        for (const step of rows.of(AGENT_RUN_STEPS).map((row) => storedStepOfRow(row))) {
            if (!runIds.includes(step.runId)) continue
            const held = counts.get(step.runId) ?? { total: 0, done: 0, begun: 0, failed: 0 }
            counts.set(step.runId, {
                total: held.total + 1,
                done: held.done + (step.status === "done" ? 1 : 0),
                begun: held.begun + (step.status === "pending" ? 0 : 1),
                failed: held.failed + (step.status === "failed" ? 1 : 0),
            })
        }
        return Promise.resolve([...counts].map(([runId, held]): StepCounts => ({ runId, ...held })))
    },
    workItemsOf: (_tx, runIds) => {
        const seen = new Set<string>()
        const steps = sorted(rows.of(AGENT_RUN_STEPS), [["runId", "asc"], ["ordinal", "asc"], ["id", "asc"]]).map((row) => storedStepOfRow(row))
        return Promise.resolve(
            steps.flatMap((step) => {
                if (!runIds.includes(step.runId) || step.workItemId === null) return []
                const key = `${step.runId}:${step.workItemId}`
                if (seen.has(key)) return []
                seen.add(key)
                return [{ runId: step.runId, workItemId: step.workItemId }]
            }),
        )
    },
})

const textOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null)

/** A ledger row as the store hands it out: a member the row does not hold reads null. */
export const storedEffectOfRow = (row: RecordRow): StoredEffect => {
    const data = structuredClone(row.data)
    const jsonOrNull = (value: unknown): StoredEffect["args"] =>
        typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null
    return {
        effectKey: String(data.effectKey),
        effectId: String(data.effectId),
        subjectEntity: String(data.subjectEntity),
        subjectId: String(data.subjectId),
        undoneAt: textOrNull(data.undoneAt),
        runId: textOrNull(data.runId),
        stepKey: textOrNull(data.stepKey),
        args: jsonOrNull(data.args),
        facts: jsonOrNull(data.facts),
        createdAt: row.createdAt,
    }
}

/**
 * The effect ledger on a table double: the insert of a key another write holds answers false (nothing written). A row keeps the members
 * the call names (a null member is left out, as a column left at its default).
 */
export const memoryEffectStore = (rows: TableRows): NodeEffectStore => ({
    byKey: (_ws, effectKey) => Promise.resolve(rows.of(AGENT_NODE_EFFECTS, { effectKey }).map((row) => storedEffectOfRow(row)).at(0) ?? null),
    ofStep: (_ws, runId, stepKey, limit) =>
        Promise.resolve(
            sorted(rows.of(AGENT_NODE_EFFECTS, { runId, stepKey }), [["createdAt", "asc"], ["id", "asc"]])
                .slice(0, limit)
                .map((row) => storedEffectOfRow(row)),
        ),
    insert: (_ws, effect) =>
        Promise.resolve(
            writtenOf(rows, {
                op: "insert",
                entity: AGENT_NODE_EFFECTS,
                values: valuesOf(Object.fromEntries(Object.entries(effect).filter(([, value]) => value !== null))),
            }) !== null,
        ),
    resettle: (_ws, effectKey, unknownKind, subject) => {
        const row = rows.of(AGENT_NODE_EFFECTS, { effectKey }).find((one) => one.data.subjectEntity === unknownKind)
        if (row === undefined) return Promise.resolve(false)
        const values = valuesOf({ subjectEntity: subject.subjectEntity, subjectId: subject.subjectId, facts: subject.facts })
        return Promise.resolve(
            writtenOf(rows, { op: "update", entity: AGENT_NODE_EFFECTS, key: row.id, expected: row.version, values }) !== null,
        )
    },
})

/** A workflow record read from a row of the workflows table double. */
export const workflowRecordOfRow = (row: RecordRow): ReturnType<typeof workflowRecordOf> => workflowRecordOf(entityOf(row))

/** A workflow version record read from a row of the workflow versions table double. */
export const workflowVersionRecordOfRow = (row: RecordRow): ReturnType<typeof workflowVersionRecordOf> =>
    workflowVersionRecordOf(entityOf(row))

/** A graph version record read from a row of the graph versions table double. */
export const graphVersionRecordOfRow = (row: RecordRow): ReturnType<typeof versionRecordOf> => versionRecordOf(entityOf(row))
