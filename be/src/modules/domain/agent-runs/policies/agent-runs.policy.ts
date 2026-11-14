/** How long one try of a step may run when its row names none, milliseconds: what a thread's step row is written and read with. */
export const DEFAULT_DEADLINE_MS = 120_000

/** The failure code of a tool whose result was never stored: the tool may have acted, so it is never called again. */
export const TOOL_OUTCOME_UNKNOWN = "tool_outcome_unknown"

/** A closed approval has no recorded principal, so execution waits for a person to reconcile its authority. */
export const DECISION_ACTOR_UNKNOWN = "decision_actor_unknown"

/** The code a run and its stopped steps carry when an owner or manager cancelled the run. */
export const RUN_CANCELLED = "run_cancelled"

/** The code a step left open carries when its run ended `done` (a done run has no terminal error of its own to give it). */
export const RUN_ENDED = "run_ended"

/**
 * The statuses of a step row that is still open: what `tools reseed` counts as not drained, and what every road that ends a run closes
 * in the same transaction (`AgentRunRecordsService.closeOpenSteps`).
 */
export const OPEN_STEP_STATUSES: ReadonlyArray<string> = ["pending", "running"]

/**
 * How many runs execute at once when the app says nothing (`AGENT_RUNS_CONCURRENCY`): the drains the api, the one consumer of the
 * agent-turn queue, runs at once. A run parked at a wait or a stop holds none: its turn ended (only a drain in flight holds a slot).
 */
export const RUNS_CONCURRENCY = 100

/** The most runs the app may be told to execute at once: a bound against a typo, far above what one api process carries. */
export const RUNS_CONCURRENCY_MAX = 1000


/** The most steps one run holds and reads: a run is a short chain, and one page of the engine holds them all. */
export const STEPS_MAX = 100

/** The tries of a run write that lost its version to another writer, before the caller is told to try again. */
export const SETTLE_TRIES = 5

/** The stored status of a run in flight between steps or in one; a run parked at a `wait` keeps it, with its wait mark. */
const RUNNING = "running"

/** The status a reader that SHOWS runs reports for a run parked at a `wait` (stored `running` WITH a wait mark): it waits. */
export const WAIT_PARKED_STATUS = "waiting"

/**
 * The status a run is REPORTED in by the readers that show runs (the desk, the runs list): the stored status, except that a `running`
 * run carrying a wait mark (parked at a `wait`, its turn ended) reads `waiting`. Derived from the mark the engine already keeps; no second
 * stored status.
 */
export const reportedStatusOf = (status: string, waitMarked: boolean): string =>
    status === RUNNING && waitMarked ? WAIT_PARKED_STATUS : status
