import type { StepSpec } from "../agent-runs.contracts"

/** The tries a step gets when its spec names none. */
export const DEFAULT_MAX_ATTEMPTS = 3

/** The most tries a step may be given. */
export const MAX_ATTEMPTS_CEILING = 10

/** How long one try may run when the spec names none, milliseconds. */
export const DEFAULT_DEADLINE_MS = 120_000

/** The shortest deadline a try may be given, milliseconds. */
export const DEADLINE_MIN_MS = 1000

/** The longest deadline a try may be given, milliseconds. */
export const DEADLINE_MAX_MS = 3_600_000

/** The pause after the first failed try, milliseconds; it doubles with each try. */
export const BACKOFF_BASE_MS = 2000

/** The longest pause between two tries, milliseconds: the backoff is bounded. */
export const BACKOFF_MAX_MS = 60_000

/** The tries a compensation gets before the run goes to a person. */
export const COMPENSATION_ATTEMPTS = 3

/** The pause after a failed compensation, seconds. */
export const COMPENSATION_RETRY_SECONDS = 30

/** How long a compensation claim lasts, seconds. */
export const COMPENSATION_LEASE_SECONDS = 120

/** The most steps one advance drives before it leaves the rest to a job, so a long run never holds a worker for ever. */
export const ADVANCE_MAX_STEPS = 50

/** How long a shutdown waits for the steps in flight before it gives their claims back, milliseconds. */
export const SHUTDOWN_WAIT_MS = 10_000

/** The most items one sweep pass reads of each kind. */
export const SWEEP_LIMIT = 50

/** The failure code of a tool whose result was never stored: the tool may have acted, so it is never called again. */
export const TOOL_OUTCOME_UNKNOWN = "tool_outcome_unknown"

/** The failure code of a step whose handler threw. */
export const HANDLER_THREW = "handler_threw"

/** The failure code of a step kind nobody handles. */
export const NO_HANDLER = "no_handler"

/** The failure code of a wait whose time ran out with no answer. */
export const WAIT_TIMEOUT = "wait_timeout"

/** The failure code of a step whose claim ran out on its last try. */
export const STEP_TIMEOUT = "step_timeout"

/** The pause before the try that follows `attempt` failed tries, milliseconds: doubling, never above the ceiling. */
export const backoffMs = (attempt: number): number =>
    Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1))

/** A pause in whole seconds, rounded up, for a database function. */
export const secondsOf = (ms: number): number => Math.ceil(ms / 1000)

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, Math.trunc(value)))

/** A step spec with its budget filled and bounded, as the database function writes it. */
export interface FilledSpec extends StepSpec {
    /** The tries it gets. */
    readonly maxAttempts: number
    /** How long one try may run, milliseconds. */
    readonly deadlineMs: number
}

/** Fills the tries and the deadline a spec leaves out and bounds both. */
export const filled = (spec: StepSpec): FilledSpec => ({
    ...spec,
    maxAttempts: clamp(spec.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 1, MAX_ATTEMPTS_CEILING),
    deadlineMs: clamp(spec.deadlineMs ?? DEFAULT_DEADLINE_MS, DEADLINE_MIN_MS, DEADLINE_MAX_MS),
})
