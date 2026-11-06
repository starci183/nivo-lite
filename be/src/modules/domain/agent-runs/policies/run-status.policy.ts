import type { AgentStepStatus } from "../agent-runs.contracts"

/** The part of a step the run status reads. */
export interface StatusStep {
    /** Where the step stands. */
    readonly status: AgentStepStatus
    /** The work item it waits on, or null. */
    readonly waitItemId: string | null
}

/**
 * Where a run stands after one of its steps changed: running while a step follows or can run, done when every step is done and none follows,
 * waiting only when nothing can run and a wait is open. A wait parks its own branch, not the run.
 */
export const statusAfter = (steps: ReadonlyArray<StatusStep>, more: boolean): "running" | "waiting" | "done" => {
    if (more) return "running"
    if (steps.every((step) => step.status === "done")) return "done"
    const runnable = steps.some(
        (step) =>
            step.status === "pending" ||
            step.status === "failed" ||
            (step.status === "running" && step.waitItemId === null),
    )
    return runnable ? "running" : "waiting"
}

/** The statuses of a run that has ended or been given away: no step is appended or claimed. */
export const CLOSED_RUN: ReadonlyArray<string> = ["done", "failed", "parked", "dead", "compensating", "compensated"]
