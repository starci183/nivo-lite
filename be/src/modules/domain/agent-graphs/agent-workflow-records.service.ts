import { Injectable } from "@nestjs/common"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Mutation } from "@nivo-lite/agent-sdk/mutation"
import type { FilterExpr, OrderBy } from "@nivo-lite/agent-sdk/query"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { runWorkflowPinOf, workflowRecordOf, workflowVersionRecordOf } from "./agent-workflows.mapper"
import type {
    OptionalWorkflowRecord,
    OptionalWorkflowVersionRecord,
    RecordValues,
    RunWorkflowPin,
    WorkflowRecord,
    WorkflowVersionRecord,
} from "./agent-workflows.contracts"

const WORKFLOW = "agent.workflow"
const VERSION = "agent.workflow-version"
const PIN = "agent.run-workflow"

/** Binds the cursor of every list of this store: none is paged past one bounded page. */
const LIST_SCOPE = "agent-workflows"

/** The most rows one engine page holds. */
const PAGE_SIZE = 100

const WORKFLOW_SELECT: ReadonlyArray<string> = [
    "agentId",
    "key",
    "name",
    "status",
    "primary",
    "position",
    "activeVersionId",
    "latestNumber",
    "templateId",
    "templateVersion",
    "createdBy",
]

const VERSION_SELECT: ReadonlyArray<string> = [
    "workflowId",
    "agentId",
    "number",
    "document",
    "documentHash",
    "changeKind",
    "authorKind",
    "authorId",
    "note",
    "templateId",
    "templateVersion",
    "fromNumber",
    "graphVersionId",
    "publishedAt",
]

const PIN_SELECT: ReadonlyArray<string> = ["runId", "agentId", "workflowId", "workflowVersionId", "workflowVersion"]

const eq = (field: string, value: string): FilterExpr => ({ op: "eq", field, value })

const allOf = (...of: ReadonlyArray<FilterExpr>): FilterExpr => ({ op: "and", of })

const BY_ID: OrderBy = [["id", "asc"]]
const BY_POSITION: OrderBy = [
    ["position", "asc"],
    ["id", "asc"],
]
/** Every agent's workflows in list order, agent by agent: the order of the `agent_position` index, so a workspace-wide list is served by it. */
const BY_AGENT_POSITION: OrderBy = [
    ["agentId", "asc"],
    ["position", "asc"],
    ["id", "asc"],
]
const NEWEST_NUMBER: OrderBy = [
    ["number", "desc"],
    ["id", "desc"],
]
const NEWEST_START: OrderBy = [
    ["startedAt", "desc"],
    ["id", "desc"],
]

/** What one list reads: the entity, its fields, the condition, the order and the most rows. */
interface Listing {
    readonly entity: string
    readonly select: ReadonlyArray<string>
    readonly where: FilterExpr
    readonly order: OrderBy
    readonly size: number
}

const unreadable = (): AgentGraphsError => new AgentGraphsError({ code: AgentGraphsErrorCode.RecordUnreadable })

@Injectable()
/**
 * The one place that names the workflow entities: the workflows of an agent, their append-only versions (inserted once, never updated)
 * and the pin of a run to the version it executes. Reads go through indexed queries of the entity engine, writes are engine mutations,
 * a workflow patch under the record version (fence) the caller read. Every method runs in the `ScopedTx` it is given.
 */
export class AgentWorkflowRecordsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly mutations: EntityMutationService,
    ) {}

    /** One workflow, or null. */
    workflow(tx: ScopedTx, workflowId: string): Promise<OptionalWorkflowRecord> {
        return this.byId(tx, WORKFLOW, workflowId, workflowRecordOf)
    }

    /** The workflows of an agent in list order, at most `limit`. */
    workflowsOf(tx: ScopedTx, agentId: string, limit: number): Promise<ReadonlyArray<WorkflowRecord>> {
        const where = eq("agentId", agentId)
        return this.listed(
            tx,
            { entity: WORKFLOW, select: WORKFLOW_SELECT, where, order: BY_POSITION, size: limit },
            workflowRecordOf,
        )
    }

    /** Every workflow of the workspace the transaction is scoped to, of every agent: what an end hand-off may call. */
    workflowsOfWorkspace(tx: ScopedTx, limit: number): Promise<ReadonlyArray<WorkflowRecord>> {
        return this.listed(
            tx,
            { entity: WORKFLOW, select: WORKFLOW_SELECT, where: { op: "notNull", field: "agentId" }, order: BY_AGENT_POSITION, size: limit },
            workflowRecordOf,
        )
    }

    /** Inserts a workflow; null when the agent already holds one under its key. */
    insertWorkflow(tx: ScopedTx, values: RecordValues): Promise<OptionalWorkflowRecord> {
        return this.written(tx, { op: "insert", entity: WORKFLOW, values }, workflowRecordOf)
    }

    /** Writes the workflow's fields under the version the caller read: the workflow after, or null when it had moved on. */
    patchWorkflow(tx: ScopedTx, workflow: WorkflowRecord, values: RecordValues): Promise<OptionalWorkflowRecord> {
        const mutation: Mutation = {
            op: "update",
            entity: WORKFLOW,
            key: workflow.id,
            expected: workflow.fence,
            values,
        }
        return this.written(tx, mutation, workflowRecordOf)
    }

    /** One version, or null. */
    version(tx: ScopedTx, versionId: string): Promise<OptionalWorkflowVersionRecord> {
        return this.byId(tx, VERSION, versionId, workflowVersionRecordOf)
    }

    /** The versions of a workflow, newest first, at most `limit`. */
    versionsOf(tx: ScopedTx, workflowId: string, limit: number): Promise<ReadonlyArray<WorkflowVersionRecord>> {
        const where = eq("workflowId", workflowId)
        return this.listed(
            tx,
            { entity: VERSION, select: VERSION_SELECT, where, order: NEWEST_NUMBER, size: limit },
            workflowVersionRecordOf,
        )
    }

    /** The version of an agent's workflow that published or adopted this agent graph version, or null. */
    async versionOfGraphVersion(
        tx: ScopedTx,
        agentId: string,
        graphVersionId: string,
    ): Promise<OptionalWorkflowVersionRecord> {
        const where = allOf(eq("agentId", agentId), eq("graphVersionId", graphVersionId))
        const found = await this.listed(
            tx,
            { entity: VERSION, select: VERSION_SELECT, where, order: BY_ID, size: 1 },
            workflowVersionRecordOf,
        )
        return found.at(0) ?? null
    }

    /** Inserts a version; null when the workflow already holds its number. */
    insertVersion(tx: ScopedTx, values: RecordValues): Promise<OptionalWorkflowVersionRecord> {
        return this.written(tx, { op: "insert", entity: VERSION, values }, workflowVersionRecordOf)
    }

    /** Pins a run to its workflow version once: a replay of the run finds the pin there and writes nothing. */
    async pinRun(tx: ScopedTx, values: RecordValues): Promise<void> {
        const result = await this.mutations.mutate(tx, { op: "ensure", entity: PIN, match: "run", values }, "job")
        if (!result.ok) throw unreadable()
    }

    /** The pins of these runs. */
    pinsOf(tx: ScopedTx, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<RunWorkflowPin>> {
        if (runIds.length === 0) return Promise.resolve([])
        const where: FilterExpr = { op: "in", field: "runId", values: [...runIds] }
        return this.listed(
            tx,
            { entity: PIN, select: PIN_SELECT, where, order: BY_ID, size: runIds.length },
            runWorkflowPinOf,
        )
    }

    /** The newest runs of an agent pinned to one workflow, at most `limit`. */
    runsOfWorkflow(
        tx: ScopedTx,
        agentId: string,
        workflowId: string,
        limit: number,
    ): Promise<ReadonlyArray<RunWorkflowPin>> {
        const where = allOf(eq("agentId", agentId), eq("workflowId", workflowId))
        return this.listed(
            tx,
            { entity: PIN, select: PIN_SELECT, where, order: NEWEST_START, size: limit },
            runWorkflowPinOf,
        )
    }

    private async byId<T>(tx: ScopedTx, entity: string, id: string, read: (row: RecordRow) => T): Promise<T | null> {
        const row = await this.engine.get(tx, entity, id)
        return row === null ? null : read(row)
    }

    private async listed<T>(tx: ScopedTx, listing: Listing, read: (row: RecordRow) => T): Promise<ReadonlyArray<T>> {
        const { entity, select, where, order, size } = listing
        const page = await this.engine.list(
            tx,
            { from: entity, select, where, order, page: { size: Math.min(PAGE_SIZE, size) } },
            LIST_SCOPE,
        )
        return page.rows.map((row) => read(row.row))
    }

    private async written<T>(tx: ScopedTx, mutation: Mutation, read: (row: RecordRow) => T): Promise<T | null> {
        const result = await this.mutations.mutate(tx, mutation, "job")
        if (result.ok) return read(result.row)
        if (result.reason === "stale" || result.reason === "taken") return null
        throw unreadable()
    }
}
