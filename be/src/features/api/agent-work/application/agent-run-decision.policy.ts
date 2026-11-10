import type { AgentRunDecision, AgentRunDecisionOption, AgentRunItem, AgentRunStepLine } from "./read-agent-runs.contracts"

/** The actions whose item only wants another try once the owner has put the cause right: approving them runs the work again. */
export const RETRY_ACTIONS: ReadonlySet<string> = new Set(["connect_sepay", "grant_payment_tool"])

/** The answers offered for an item of this action: an item that wants another try offers a retry and a refusal, any other an approval and a refusal. */
export const optionsOf = (action: string): ReadonlyArray<AgentRunDecisionOption> =>
    RETRY_ACTIONS.has(action) ? ["retry", "reject"] : ["approve", "reject"]

/** The step that waits on a work item: the first one in a waiting state that names an item. */
export const waitingStepOf = (steps: ReadonlyArray<AgentRunStepLine>): AgentRunStepLine | null =>
    steps.find((step) => step.status === "waiting" && step.workItemId !== null) ?? null

/**
 * The work item a run's decision is about: the item the waiting step waits on, else the item the run is about when that one waits for a
 * person. Null when neither does.
 */
export const decidingItemIdOf = (steps: ReadonlyArray<AgentRunStepLine>, item: AgentRunItem | null): string | null =>
    waitingStepOf(steps)?.workItemId ?? (item?.status === "waiting_decision" ? item.id : null)

/** The decision a run waits on, for the item it is about; null when the item does not wait for a person. */
export const decisionOf = (
    steps: ReadonlyArray<AgentRunStepLine>,
    item: AgentRunItem,
    requestId: string | null,
): AgentRunDecision | null => {
    if (item.status !== "waiting_decision") return null
    const step = waitingStepOf(steps)
    return {
        decisionId: requestId ?? item.id,
        workItemId: item.id,
        stepKey: step?.workItemId === item.id ? step.stepKey : null,
        title: item.summary,
        options: optionsOf(item.action),
    }
}
