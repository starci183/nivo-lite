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
export const CLOSED_RUN: ReadonlyArray<string> = [
    "done",
    "failed",
    "parked",
    "dead",
    "compensating",
    "compensated",
    "cancelled",
]

/**
 * The statuses of a run that stopped on a failed step and may be run again from it: parked for a fix, failed after its tries, or given to
 * a person (dead). A run that was undone, is being undone, is done or still runs is not on this list.
 */
export const RESUMABLE_RUN: ReadonlyArray<string> = ["parked", "failed", "dead"]

/** The statuses of a step that say the run undid, or is undoing, what it had done: nothing is left to run again from. */
export const UNDONE_STEP: ReadonlyArray<string> = ["compensating", "compensated"]
