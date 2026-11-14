import type {
    AgentRunDecision,
    AgentRunDecisionOption,
    AgentRunItem,
    AgentRunStepLine,
} from "./agent-runs-view.contracts"

/** The actions whose item only wants another try once the owner has put the cause right: approving them runs the work again. */
export const RETRY_ACTIONS: ReadonlySet<string> = new Set(["connect_sepay", "grant_payment_tool"])

/** The answers offered for an item of this action: an item that wants another try offers a retry and a refusal, any other an approval and a refusal. */
export const optionsOf = (action: string): ReadonlyArray<AgentRunDecisionOption> =>
    RETRY_ACTIONS.has(action) ? ["retry", "reject"] : ["approve", "reject"]

/**
 * What a person's verdict on a waiting item is read as: an approval (the item's work goes on), a refusal of the item, or NOT an answer
 * this item takes, with the verdicts it does take.
 */
export type RunVerdictReading =
    | { readonly kind: "approve" }
    | { readonly kind: "reject" }
    | { readonly kind: "not_offered"; readonly accepted: ReadonlyArray<AgentRunDecisionOption> }

/**
 * Reads a verdict against the closed set the item's action offers (`optionsOf`). Only a verdict of that set is an answer: `reject`
 * refuses the item, the set's other word (`approve`, or `retry` for an item that only wants another try) lets its work go on. Any
 * other word, an empty one included, is no answer: it is never read as an approval, and the caller is told what the item takes.
 */
export const verdictOf = (action: string, verdict: string): RunVerdictReading => {
    const accepted = optionsOf(action)
    const offered: ReadonlyArray<string> = accepted
    if (!offered.includes(verdict)) return { kind: "not_offered", accepted }
    return verdict === "reject" ? { kind: "reject" } : { kind: "approve" }
}

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
): AgentRunDecision | null => {
    if (item.status !== "waiting_decision") return null
    const step = waitingStepOf(steps)
    return {
        decisionId: item.id,
        workItemId: item.id,
        stepKey: step?.workItemId === item.id ? step.stepKey : null,
        title: item.summary,
        options: optionsOf(item.action),
    }
}
