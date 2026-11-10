import type { RunStop } from "./stops/run-stop.contracts"

/** The fact of an approval stop that names the owner's `approve_tool_call` item (the fact `ThreadApprovalsService.asked` writes). */
export const APPROVAL_ITEM_FACT = "workItemId"

/** The owner item an open approval stop waits on, and the step of that stop. */
export interface OpenApprovalItem {
    /** The step that asked. */
    readonly stepKey: string
    /** The `approve_tool_call` work item. */
    readonly workItemId: string
}

/**
 * The owner item an open approval stop of a run waits on (of the named step, else the run's newest open approval), or null: what the
 * run page decides through the inbox's own door, since a thread step names no item of its own (`waitItemId` is null by design).
 */
export const openApprovalItemOf = (stops: ReadonlyArray<RunStop>, stepKey: string | null): OpenApprovalItem | null => {
    const stop = stops
        .filter((one) => one.kind === "approval" && one.state === "open")
        .filter((one) => stepKey === null || one.stepKey === stepKey)
        .toSorted((a, b) => b.stoppedAt.localeCompare(a.stoppedAt))
        .at(0)
    const workItemId = stop?.detail.facts.find((fact) => fact.name === APPROVAL_ITEM_FACT)?.value ?? null
    return stop === undefined || workItemId === null || workItemId === "" ? null : { stepKey: stop.stepKey, workItemId }
}
