import type { AgentStepStatus, RunFailureRoute, StepEffect } from "../agent-runs.contracts"
import { TOOL_OUTCOME_UNKNOWN, backoffMs } from "./agent-runs.policy"

/** What the route needs to know of one step of the run. */
export interface RouteStep {
    /** The step. */
    readonly stepKey: string
    /** Its place in the run. */
    readonly seq: number
    /** Where it stands. */
    readonly status: AgentStepStatus
    /** What it does to the world. */
    readonly effect: StepEffect
}

/** The facts of one failed try. */
export interface FailureFacts {
    /** Why it failed. */
    readonly code: string
    /** Whether the handler asked for another try. */
    readonly retryable: boolean
    /** The try that failed, from one. */
    readonly attempt: number
    /** The tries the step gets. */
    readonly maxAttempts: number
    /** Every step of the run. */
    readonly steps: ReadonlyArray<RouteStep>
}

const doneAndPivot = (step: RouteStep): boolean => step.status === "done" && step.effect.kind === "pivot"

const doneAndCompensable = (step: RouteStep): boolean => step.status === "done" && step.effect.kind === "compensable"

/**
 * Where a failure goes. A tool whose outcome is unknown goes to a person and is never called again. Otherwise the step is tried again
 * after a bounded backoff while it has tries. Past its tries: when a pivot is done nothing is undone and a person decides (the pivot is
 * named); when none is, the done compensable steps are undone in reverse order, and with none to undo a person decides.
 */
export const routeFailure = (facts: FailureFacts): RunFailureRoute => {
    const pivots = facts.steps.filter(doneAndPivot).sort((a, b) => b.seq - a.seq)
    const pivotKey = pivots[0]?.stepKey ?? null
    if (facts.code === TOOL_OUTCOME_UNKNOWN) return { kind: "person", pivotKey }
    if (facts.retryable && facts.attempt < facts.maxAttempts) {
        return { kind: "retry", afterMs: backoffMs(facts.attempt) }
    }
    if (pivotKey !== null) return { kind: "person", pivotKey }
    const undo = facts.steps.filter(doneAndCompensable).sort((a, b) => b.seq - a.seq)
    if (undo.length === 0) return { kind: "person", pivotKey: null }
    return { kind: "compensate", stepKeys: undo.map((step) => step.stepKey) }
}
