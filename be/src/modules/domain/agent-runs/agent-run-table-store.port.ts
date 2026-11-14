import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type {
    RunCount,
    RunCountFilter,
    RunInsert,
    RunListFilter,
    RunPinValues,
    RunValues,
    RunWaiterFilter,
    RunWaitMark,
    RunWorkItem,
    OptionalStoredRun,
    OptionalStoredStep,
    StepCounts,
    StepInsert,
    StepValues,
    StoredRun,
    StoredStep,
    StoredWaiter,
} from "./agent-runs-rows.contracts"

/**
 * The runs and their steps (public.agent_runs, agent_run_steps). Every member runs in the transaction of the `ScopedTx` it is given, on
 * the workspace it names, and never opens one: a run opens in the transaction that marks its thread opened. A write answers null when a
 * unique key holds its row already or, under a fence, when the row moved on (nothing written).
 */
export interface AgentRunTableStore {
    /** One run, or null. */
    run(tx: ScopedTx, id: string): Promise<OptionalStoredRun>
    /** The run of a wake, or null. */
    runOfWake(tx: ScopedTx, wakeId: string): Promise<OptionalStoredRun>
    /** The runs a filter names, in its order, at most `limit`. */
    runs(tx: ScopedTx, filter: RunListFilter, limit: number): Promise<ReadonlyArray<StoredRun>>
    /** How many runs a filter names, per agent and status. */
    counts(tx: ScopedTx, filter: RunCountFilter): Promise<ReadonlyArray<RunCount>>
    /** Writes a run; null when its wake holds one already. */
    insertRun(tx: ScopedTx, run: RunInsert): Promise<OptionalStoredRun>
    /** Writes members of a run at the fence read. */
    patchRun(tx: ScopedTx, id: string, fence: string, values: RunValues): Promise<OptionalStoredRun>
    /**
     * Marks the wait a run is parked on (its lookup keys and since when), or clears it (null). Not fenced and the fence is not moved: the
     * mark is the run's own index, written only by the step that parks or resumes it, and no other write reads or sets it.
     */
    markWait(tx: ScopedTx, id: string, mark: RunWaitMark | null): Promise<void>
    /** The runs one event is asked of (`RunWaiterFilter`), every one, unordered. */
    waiters(tx: ScopedTx, filter: RunWaiterFilter): Promise<ReadonlyArray<StoredWaiter>>
    /** Pins a run to the workflow version it executes when it names none yet: false when it already does, or is gone. */
    pinRun(tx: ScopedTx, id: string, pin: RunPinValues): Promise<boolean>
    /** The steps of a run in order, at most `limit`. */
    steps(tx: ScopedTx, runId: string, limit: number): Promise<ReadonlyArray<StoredStep>>
    /** Writes a step; null when its run holds its key already. */
    insertStep(tx: ScopedTx, step: StepInsert): Promise<OptionalStoredStep>
    /** Writes members of a step at the fence read. */
    patchStep(tx: ScopedTx, id: string, fence: string, values: StepValues): Promise<OptionalStoredStep>
    /** How far the steps of each of these runs have come; a run with no step is left out. */
    stepCounts(tx: ScopedTx, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<StepCounts>>
    /** The work items the steps of these runs are about, one entry per run and item. */
    workItemsOf(tx: ScopedTx, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<RunWorkItem>>
}

/** The injection token of the run table store. */
export const AGENT_RUN_TABLE_STORE: unique symbol = Symbol("AGENT_RUN_TABLE_STORE")

/** Injects the run table store. Parameter type: AgentRunTableStore. */
export const InjectAgentRunTableStore = (): TypedParameterDecorator<AgentRunTableStore> =>
    injector<AgentRunTableStore>(AGENT_RUN_TABLE_STORE)
