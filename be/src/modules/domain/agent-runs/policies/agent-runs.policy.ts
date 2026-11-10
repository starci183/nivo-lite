/** How long one try of a step may run when its row names none, milliseconds: what a thread's step row is written and read with. */
export const DEFAULT_DEADLINE_MS = 120_000

/** The failure code of a tool whose result was never stored: the tool may have acted, so it is never called again. */
export const TOOL_OUTCOME_UNKNOWN = "tool_outcome_unknown"

/** A closed approval has no recorded principal, so execution waits for a person to reconcile its authority. */
export const DECISION_ACTOR_UNKNOWN = "decision_actor_unknown"

/** The code a run and its stopped steps carry when an owner or manager cancelled the run. */
export const RUN_CANCELLED = "run_cancelled"

/** How many runs one process drives at once when the app says nothing. */
export const RUNS_CONCURRENCY = 4

/** The most runs one process may be told to drive at once. */
export const RUNS_CONCURRENCY_MAX = 64

/** The most steps one run holds and reads: a run is a short chain, and one page of the engine holds them all. */
export const STEPS_MAX = 100

/** The tries of a run write that lost its version to another writer, before the caller is told to try again. */
export const SETTLE_TRIES = 5
