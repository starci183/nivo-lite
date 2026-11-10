import { Injectable } from "@nestjs/common"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type { AggregateRow, EngineResult, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"
import type { FilterExpr, OrderBy, Query } from "@nivo-lite/agent-sdk/query"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import { runRecordOf, stepRecordOf } from "./agent-runs.mapper"
import type { RunRecord, StepRecord } from "./agent-runs-records.contracts"
import { STEPS_MAX } from "./policies/agent-runs.policy"

/** The entity of a run. */
const RUN = "agent.run"

/** The entity of a step. */
const STEP = "agent.run-step"

/** Binds the cursor of every list of this capability: none is paged, each reads one bounded page. */
const LIST_SCOPE = "agent-runs"

const RUN_SELECT: ReadonlyArray<string> = [
    "agentId",
    "wakeId",
    "trigger",
    "graphVersionId",
    "planning",
    "status",
    "engine",
    "context",
    "error",
    "deadLetteredAt",
    "parkedBuild",
    "resumeAttempts",
    "resumeNotBefore",
    "endedAt",
    "startedAt",
    "stepSeq",
    "cancelledAt",
    "cancelledBy",
]

const STEP_SELECT: ReadonlyArray<string> = [
    "runId",
    "ordinal",
    "stepKey",
    "nodeKey",
    "kind",
    "effect",
    "input",
    "result",
    "status",
    "attempt",
    "maxAttempts",
    "deadlineMs",
    "claimedUntil",
    "notBefore",
    "waitItemId",
    "workItemId",
    "compAttempts",
    "errorCode",
]

/** The fields of a step the run page reads beyond the engine's own: its moments, its door calls and its error. */
const STEP_VIEW_SELECT: ReadonlyArray<string> = [...STEP_SELECT, "startedAt", "endedAt", "durationMs", "doorCalls", "error"]

/** The most runs one list of an agent holds. */
const RUNS_PAGE = 50

const rejected = (): AgentRunsError => new AgentRunsError({ code: AgentRunsErrorCode.ResultRejected })

@Injectable()
/**
 * The one place that names the run entities: reads through indexed queries of the entity engine, writes as engine updates under the
 * version the caller read. Every method runs in the scope of the `ScopedTx` it is given and never opens a transaction.
 */
export class AgentRunRecordsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly mutations: EntityMutationService,
    ) {}

    /** The run, or null. */
    async run(tx: ScopedTx, runId: string): Promise<RunRecord | null> {
        const row = await this.engine.get(tx, RUN, runId)
        return row === null ? null : runRecordOf(row)
    }

    /** The run of a wake, or null. */
    async runOfWake(tx: ScopedTx, wakeId: string): Promise<RunRecord | null> {
        const rows = await this.rows(tx, {
            from: RUN,
            select: RUN_SELECT,
            where: { op: "eq", field: "wakeId", value: wakeId },
            order: [["id", "asc"]],
            page: { size: 1 },
        })
        return rows.map(runRecordOf).at(0) ?? null
    }

    /** The newest runs of one agent, newest first, at most `limit` (the index of the agent and its start). */
    async runsOfAgent(tx: ScopedTx, agentId: string, limit: number): Promise<ReadonlyArray<RunRecord>> {
        const rows = await this.rows(tx, {
            from: RUN,
            select: RUN_SELECT,
            where: { op: "eq", field: "agentId", value: agentId },
            order: [
                ["startedAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: Math.min(limit, RUNS_PAGE) },
        })
        return rows.map(runRecordOf)
    }

    /** How many steps each run holds, how many are done, how many have begun or failed: one grouped read for the runs given. */
    stepCountsOf(tx: ScopedTx, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<AggregateRow>> {
        if (runIds.length === 0) return Promise.resolve([])
        return this.engine.aggregate(tx, {
            from: STEP,
            where: { op: "in", field: "runId", values: runIds },
            groupBy: ["runId"],
            measures: {
                total: { kind: "count" },
                done: { kind: "count", where: { op: "in", field: "status", values: ["done", "compensated"] } },
                begun: { kind: "count", where: { op: "ne", field: "status", value: "pending" } },
                failed: { kind: "count", where: { op: "eq", field: "status", value: "failed" } },
            },
            limit: runIds.length,
        })
    }

    /** The work item each run's steps are about: one row per run and item, for the runs given. */
    workItemsOf(tx: ScopedTx, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<AggregateRow>> {
        if (runIds.length === 0) return Promise.resolve([])
        return this.engine.aggregate(tx, {
            from: STEP,
            where: {
                op: "and",
                of: [
                    { op: "in", field: "runId", values: runIds },
                    { op: "notNull", field: "workItemId" },
                ],
            },
            groupBy: ["runId", "workItemId"],
            measures: { steps: { kind: "count" } },
            limit: runIds.length * 2,
        })
    }

    /** The rows of the steps of a run in order, with the moments, the door calls and the error the run page draws. */
    stepRowsOf(tx: ScopedTx, runId: string): Promise<ReadonlyArray<RecordRow>> {
        return this.rows(tx, {
            from: STEP,
            select: STEP_VIEW_SELECT,
            where: { op: "eq", field: "runId", value: runId },
            order: [
                ["ordinal", "asc"],
                ["id", "asc"],
            ],
            page: { size: STEPS_MAX },
        })
    }

    /** The runs of one status that `where` narrows, in the order of an index, at most `limit`. */
    async runsOf(
        tx: ScopedTx,
        status: string,
        where: FilterExpr | null,
        order: OrderBy,
        limit: number,
    ): Promise<ReadonlyArray<RunRecord>> {
        const rows = await this.rows(tx, {
            from: RUN,
            select: RUN_SELECT,
            where: this.pinned(status, where),
            order,
            page: { size: limit },
        })
        return rows.map(runRecordOf)
    }

    /** The steps of a run in order. */
    async stepsOf(tx: ScopedTx, runId: string): Promise<ReadonlyArray<StepRecord>> {
        const rows = await this.rows(tx, {
            from: STEP,
            select: STEP_SELECT,
            where: { op: "eq", field: "runId", value: runId },
            order: [
                ["ordinal", "asc"],
                ["id", "asc"],
            ],
            page: { size: STEPS_MAX },
        })
        return rows.map(stepRecordOf)
    }

    /** The steps of one status that `where` narrows, in the order of an index, at most `limit`. */
    async stepsOfStatus(
        tx: ScopedTx,
        status: string,
        where: FilterExpr | null,
        order: OrderBy,
        limit: number,
    ): Promise<ReadonlyArray<StepRecord>> {
        const rows = await this.rows(tx, {
            from: STEP,
            select: STEP_SELECT,
            where: this.pinned(status, where),
            order,
            page: { size: limit },
        })
        return rows.map(stepRecordOf)
    }

    /** The steps that wait on a work item. */
    async stepsWaitingOn(tx: ScopedTx, workItemId: string): Promise<ReadonlyArray<StepRecord>> {
        const rows = await this.rows(tx, {
            from: STEP,
            select: STEP_SELECT,
            where: { op: "eq", field: "waitItemId", value: workItemId },
            order: [["id", "asc"]],
            page: { size: 5 },
        })
        return rows.map(stepRecordOf)
    }

    /** At most `limit` steps of a kind that are about a work item, whatever their status. */
    async stepsAbout(
        tx: ScopedTx,
        kind: string,
        workItemId: string,
        limit: number,
    ): Promise<ReadonlyArray<StepRecord>> {
        const rows = await this.rows(tx, {
            from: STEP,
            select: STEP_SELECT,
            where: {
                op: "and",
                of: [
                    { op: "eq", field: "kind", value: kind },
                    { op: "eq", field: "workItemId", value: workItemId },
                ],
            },
            order: [["id", "asc"]],
            page: { size: limit },
        })
        return rows.map(stepRecordOf)
    }

    /** Inserts a run; `taken` when its wake already has one. */
    insertRun(tx: ScopedTx, values: MutationValues): Promise<EngineResult> {
        return this.mutations.mutate(tx, { op: "insert", entity: RUN, values }, "job")
    }

    /** Inserts a step of a run; `taken` when the run already holds that step key. */
    insertStep(tx: ScopedTx, runId: string, values: MutationValues): Promise<EngineResult> {
        return this.mutations.mutate(
            tx,
            { op: "insert", entity: STEP, values: { ...values, runId }, links: { run: runId } },
            "job",
        )
    }

    /** Writes the run's fields under the version the caller read: the record after, or null when its version had moved on. */
    async patchRun(tx: ScopedTx, run: RunRecord, values: MutationValues): Promise<RunRecord | null> {
        const result = await this.mutations.mutate(
            tx,
            { op: "update", entity: RUN, key: run.id, expected: run.version, values },
            "job",
        )
        return this.writtenOf(result, runRecordOf)
    }

    /** Writes the step's fields under the version the caller read: the record after, or null when its version had moved on. */
    async patchStep(tx: ScopedTx, step: StepRecord, values: MutationValues): Promise<StepRecord | null> {
        const result = await this.mutations.mutate(
            tx,
            { op: "update", entity: STEP, key: step.id, expected: step.version, values },
            "job",
        )
        return this.writtenOf(result, stepRecordOf)
    }

    private async rows(tx: ScopedTx, query: Query): Promise<ReadonlyArray<RecordRow>> {
        const page = await this.engine.list(tx, query, LIST_SCOPE)
        return page.rows.map((row) => row.row)
    }

    private pinned(status: string, where: FilterExpr | null): FilterExpr {
        const byStatus: FilterExpr = { op: "eq", field: "status", value: status }
        return where === null ? byStatus : { op: "and", of: [byStatus, where] }
    }

    private writtenOf<T>(result: EngineResult, read: (row: RecordRow) => T): T | null {
        if (result.ok) return read(result.row)
        if (result.reason === "stale") return null
        throw rejected()
    }
}
