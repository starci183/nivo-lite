import type { RunStop } from "./run-stop.contracts"

/**
 * The facts of a stop of kind `approval` the engine writes and reads back (`ThreadApprovalsService.asked` writes them): the owner's
 * `approve_tool_call` item it waits on, and the verdict kept on the stop once that item is decided, or once the stop closed another way.
 */
export const APPROVAL_FACT = { workItem: "workItemId", verdict: "verdict" } as const

/**
 * The verdict a stop keeps when it closed by any decision other than its own item's (a skip, the founder's words, a retry, a take-over,
 * the step completing, the run closing): its item is then withdrawn (closed rejected by the engine) and a later verdict on it moves
 * nothing.
 */
export const APPROVAL_WITHDRAWN = "withdrawn"

/**
 * The verdict a stop keeps when its item was DECLINED: the value the approval door keeps for the owner's decline, and the one a
 * take-over keeps (a take-over of a permission request IS its decline, by the person who takes the conversation).
 */
export const APPROVAL_DECLINED = "refused"

/** The note the item of a permission request keeps when a take-over declined it: who took over is the item's decider. */
export const DECLINED_BY_TAKEOVER = "declined_by_takeover"

/** The value of a fact of a stop, or null. */
const factOf = (stop: RunStop, name: string): string | null =>
    stop.detail.facts.find((fact) => fact.name === name)?.value ?? null

/**
 * The owner's item an approval stop still waits on: its `workItemId` while the stop keeps no verdict (the item was not decided and was
 * not withdrawn). Null for any other stop, and for an approval stop whose item is decided or withdrawn.
 */
export const approvalItemWaitingOf = (stop: RunStop | null): string | null => {
    if (stop?.kind !== "approval" || factOf(stop, APPROVAL_FACT.verdict) !== null) return null
    const workItemId = factOf(stop, APPROVAL_FACT.workItem)
    return workItemId === null || workItemId === "" ? null : workItemId
}

/** The stop's facts with a verdict kept (any earlier verdict replaced). */
export const verdictFactsOf = (stop: RunStop, verdict: string): RunStop["detail"]["facts"] => [
    ...stop.detail.facts.filter((fact) => fact.name !== APPROVAL_FACT.verdict),
    { name: APPROVAL_FACT.verdict, value: verdict },
]

/** The stop's facts with the verdict `withdrawn` kept (any earlier verdict replaced). */
export const withdrawnFactsOf = (stop: RunStop): RunStop["detail"]["facts"] => verdictFactsOf(stop, APPROVAL_WITHDRAWN)
