import { THREAD_STOP_REASON, leadSubjectOf, subjectOfTrigger } from "./lead-freeze.policy"
import type { FreezeSubject, FreezeValues, HeldStop, LeadFreeze } from "./lead-freezes.contracts"

/** Who releases the hold of a stop that closed: the engine, never a person on the freeze. */
export const THREAD_RELEASER = "engine"

/** The statuses of a run that is over: its open stops can no longer be answered, so they hold nobody. */
const CLOSED_RUN: ReadonlySet<string> = new Set(["done", "failed", "cancelled", "compensated", "dead"])

/** Whether a freeze is the hold of a thread run's stop (and not a freeze of the old engine with its own owner item). */
export const isThreadHold = (freeze: Pick<LeadFreeze, "frozenReason"> | null): boolean =>
    freeze?.frozenReason === THREAD_STOP_REASON

/** Whether a run is over by its status; a run that is gone (null) is over too. */
export const isRunClosed = (status: string | null): boolean => status === null || CLOSED_RUN.has(status)

/**
 * Whether an open stop holds a wake of a workflow: the stop of the same workflow, or a stop of an agent's own graph (no workflow), which
 * holds the customer as a whole. A wake of another workflow of the same customer is served.
 */
export const stopHoldsWorkflow = (stop: Pick<HeldStop, "workflowId">, workflowId: string | null): boolean =>
    stop.workflowId === null || stop.workflowId === workflowId

/** Whether an open stop is about the customer: the same lead, else the same conversation. A stop with neither holds nobody. */
export const stopIsAbout = (stop: Pick<HeldStop, "leadId" | "conversationId">, subject: FreezeSubject): boolean =>
    (subject.leadId !== null && stop.leadId === subject.leadId) ||
    (subject.conversationId !== null && stop.conversationId === subject.conversationId)

/** The oldest of the stops (by the moment they stopped, then their run), or null for none. */
export const oldestStopOf = (stops: ReadonlyArray<HeldStop>): HeldStop | null =>
    [...stops].sort((one, other) =>
        one.stoppedAt === other.stoppedAt ? one.runId.localeCompare(other.runId) : one.stoppedAt.localeCompare(other.stoppedAt),
    )[0] ?? null

/** The freeze key a stop holds its customer under: the customer's lead (else conversation), in the stop's workflow. */
export const stopSubjectOf = (subject: FreezeSubject, stop: Pick<HeldStop, "workflowId">): FreezeSubject =>
    subject.leadId !== null
        ? leadSubjectOf(subject.leadId, subject.conversationId, stop.workflowId)
        : (subjectOfTrigger({ conversationId: subject.conversationId, workflowId: stop.workflowId }) ?? subject)

/**
 * The values of a freeze that starts holding a customer for a thread run's stop: a new episode pointing at the run and its stopped
 * step, no owner item (the stop's card is the one), nothing released, nobody holding the conversation.
 */
export const threadHoldOf = (freeze: Pick<LeadFreeze, "episode">, stop: HeldStop, at: string): FreezeValues => ({
    status: "frozen",
    frozenRunId: stop.runId,
    agentId: stop.agentId,
    frozenAt: at,
    frozenReason: THREAD_STOP_REASON,
    stepKey: stop.stepKey,
    stepTitle: null,
    episode: freeze.episode + 1,
    failures: 1,
    pending: [],
    workItemId: null,
    heldBy: null,
    releasedAt: null,
    releasedBy: null,
    releaseReason: null,
})
