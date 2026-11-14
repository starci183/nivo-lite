import { Injectable } from "@nestjs/common"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { InjectAgentRunTableStore, type AgentRunTableStore } from "./agent-run-table-store.port"
import { runRecordOf, stepRecordOf } from "./agent-runs.mapper"
import type {
    OptionalRunRecord,
    OptionalStepRecord,
    RunRecord,
    StepRecord,
} from "./agent-runs-records.contracts"
import type {
    OptionalStoredRun,
    OptionalStoredStep,
    RunCount,
    RunCountFilter,
    RunInsert,
    RunListFilter,
    RunPinValues,
    RunValues,
    RunWaiterFilter,
    RunWaitMark,
    RunWorkItem,
    StepCounts,
    StepInsert,
    StepValues,
    StoredRun,
    StoredStep,
    StoredWaiter,
} from "./agent-runs-rows.contracts"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import { STEPS_MAX } from "./policies/agent-runs.policy"

/** The most runs one list of an agent holds. */
const RUNS_PAGE = 50

const rejected = (): AgentRunsError => new AgentRunsError({ code: AgentRunsErrorCode.ResultRejected })

@Injectable()
/**
 * The one place the engine reads and writes the runs and their steps, on their core tables (`AGENT_RUN_TABLE_STORE`): typed records for
 * the run engine, the stored rows for the thread projection, the sweep and the readers that show them; writes under the version the caller
 * read. Every method runs in the transaction of the `ScopedTx` it is given and never opens one.
 */
export class AgentRunRecordsService {
    constructor(@InjectAgentRunTableStore() private readonly store: AgentRunTableStore) {}

    /** The run, or null. */
    async run(tx: ScopedTx, runId: string): Promise<OptionalRunRecord> {
        const row = await this.store.run(tx, runId)
        return row === null ? null : runRecordOf(row)
    }

    /** The stored row of a run, or null. */
    runRow(tx: ScopedTx, runId: string): Promise<OptionalStoredRun> {
        return this.store.run(tx, runId)
    }

    /** The run of a wake, or null. */
    async runOfWake(tx: ScopedTx, wakeId: string): Promise<OptionalRunRecord> {
        const row = await this.store.runOfWake(tx, wakeId)
        return row === null ? null : runRecordOf(row)
    }

    /** The newest runs of one agent, newest first, at most `limit`. */
    async runsOfAgent(tx: ScopedTx, agentId: string, limit: number): Promise<ReadonlyArray<RunRecord>> {
        const rows = await this.store.runs(tx, { agentId, order: "started" }, Math.min(limit, RUNS_PAGE))
        return rows.map((item) => runRecordOf(item))
    }

    /** The stored rows of the runs a filter names, in its order, at most `limit`. */
    runRows(tx: ScopedTx, filter: RunListFilter, limit: number): Promise<ReadonlyArray<StoredRun>> {
        return this.store.runs(tx, filter, limit)
    }

    /** How many runs a filter names, per agent and status. */
    runCounts(tx: ScopedTx, filter: RunCountFilter): Promise<ReadonlyArray<RunCount>> {
        return this.store.counts(tx, filter)
    }

    /** How many steps each run holds, how many are done, how many have begun or failed. */
    stepCountsOf(tx: ScopedTx, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<StepCounts>> {
        return this.store.stepCounts(tx, runIds)
    }

    /** The work items each run's steps are about: one entry per run and item. */
    workItemsOf(tx: ScopedTx, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<RunWorkItem>> {
        return this.store.workItemsOf(tx, runIds)
    }

    /** The stored rows of the steps of a run in order, with the moments, the door calls and the error the run page draws. */
    stepRowsOf(tx: ScopedTx, runId: string): Promise<ReadonlyArray<StoredStep>> {
        return this.store.steps(tx, runId, STEPS_MAX)
    }

    /** The steps of a run in order. */
    async stepsOf(tx: ScopedTx, runId: string): Promise<ReadonlyArray<StepRecord>> {
        return (await this.store.steps(tx, runId, STEPS_MAX)).map((item) => stepRecordOf(item))
    }

    /** Inserts a run; null when its wake already has one. */
    insertRun(tx: ScopedTx, values: RunInsert): Promise<OptionalStoredRun> {
        return this.store.insertRun(tx, values)
    }

    /** Writes the run's fields under the version the caller read: the run after, null when its version had moved on; a run gone is refused. */
    async patchRun(tx: ScopedTx, run: RunRecord, values: RunValues): Promise<OptionalRunRecord> {
        const row = await this.store.patchRun(tx, run.id, run.version, values)
        if (row !== null) return runRecordOf(row)
        if ((await this.store.run(tx, run.id)) === null) throw rejected()
        return null
    }

    /** Writes a stored run row under the version it was read at: the row after, or null when its version had moved on. */
    patchRunRow(tx: ScopedTx, run: StoredRun, values: RunValues): Promise<OptionalStoredRun> {
        return this.store.patchRun(tx, run.id, run.version, values)
    }

    /** Marks (or clears, null) the wait a run is parked on: the keys an event finds it by. */
    markWait(tx: ScopedTx, runId: string, mark: RunWaitMark | null): Promise<void> {
        return this.store.markWait(tx, runId, mark)
    }

    /** The runs one event is asked of: every run of the agent whose parked wait's keys the event's probe names. */
    waiters(tx: ScopedTx, filter: RunWaiterFilter): Promise<ReadonlyArray<StoredWaiter>> {
        return this.store.waiters(tx, filter)
    }

    /** Pins a run to the workflow version it executes, once: false when it already names one. */
    pinRun(tx: ScopedTx, runId: string, pin: RunPinValues): Promise<boolean> {
        return this.store.pinRun(tx, runId, pin)
    }

    /** Writes the step's fields under the version the caller read: the record after, null when its version had moved on; a step gone is refused. */
    async patchStep(tx: ScopedTx, step: StepRecord, values: StepValues): Promise<OptionalStepRecord> {
        const row = await this.store.patchStep(tx, step.id, step.version, values)
        if (row !== null) return stepRecordOf(row)
        const held = await this.store.steps(tx, step.runId, STEPS_MAX)
        if (!held.some((one) => one.id === step.id)) throw rejected()
        return null
    }

    /** Inserts a step; null when its run already holds its key. */
    insertStep(tx: ScopedTx, values: StepInsert): Promise<OptionalStoredStep> {
        return this.store.insertStep(tx, values)
    }

    /** Writes a stored step row under the version it was read at: the row after, or null when its version had moved on. */
    patchStepRow(tx: ScopedTx, step: StoredStep, values: StepValues): Promise<OptionalStoredStep> {
        return this.store.patchStep(tx, step.id, step.version, values)
    }
}
