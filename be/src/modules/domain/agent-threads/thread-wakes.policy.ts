import { ENGINE_THREAD_SOURCE } from "@modules/domain/agent-work"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import type { StopDecision } from "./stops/run-stop.contracts"
import { stopDecisionOf } from "./stops/stop-gate.policy"

/**
 * The source of the wakes a thread writes for itself: the work core's `thread` source (a person waits on a decision, so it is not
 * background work and is never skipped by the daily cap; it is restored when the agent's work is switched back on; three tries). The
 * wake names the lock scope itself, so it takes the lease of the run's own scope, never the agent's.
 */
export const THREAD_WAKE_SOURCE = ENGINE_THREAD_SOURCE

/** The source thread wakes were written under before they had their own (restart TWELVE): such a wake still in the table is still run. */
export const LEGACY_THREAD_WAKE_SOURCE = "internal"

/** The event of a wake that carries a person's decision to a stopped thread. */
export const THREAD_RESUME_EVENT = "engine.thread.resume"

/** What a resume wake carries beside the run: the decision, and the stop it answers as it stood when the decision was admitted. */
export interface ResumeCarry {
    /** The person's decision the wake carries. */
    readonly decision: StopDecision
    /** The step whose stop it answers. */
    readonly stepKey: string
    /** How many answers that stop had: the decision is applied only while it still has that many, so never twice. */
    readonly answered: number
}

/**
 * The once-key of the resume wake of a stop state: the run, the step and the count of answers its stop holds. Of two decisions on the
 * same stop state the first written wins (the wakes' unique key serialises them); the next state (one more answer) takes a new key.
 */
export const resumeOnceKeyOf = (runId: string, carry: Pick<ResumeCarry, "stepKey" | "answered">): string =>
    `thread:${runId}:${carry.stepKey}:${carry.answered}`

/** What a resume wake carries, read back from its context; null when it is not what a resume request wrote. */
export const resumeCarryOf = (text: string | undefined): ResumeCarry | null => {
    const read = text === undefined ? null : parseJsonText(text)
    if (read === null || !read.ok || !isRecord(read.value)) return null
    const decision = stopDecisionOf(read.value.decision)
    const { stepKey, answered } = read.value
    if (decision === null || typeof stepKey !== "string" || typeof answered !== "number") return null
    return { decision, stepKey, answered }
}

/** Whether two carried decisions are the same decision for the same stop state (their JSON read back, so key order cannot differ). */
export const sameResumeCarry = (kept: string | undefined, carry: string): boolean => {
    const left = resumeCarryOf(kept)
    const right = resumeCarryOf(carry)
    return left !== null && right !== null && JSON.stringify(left) === JSON.stringify(right)
}

/** A member id as the wake's actor column (a uuid) takes it. */
const MEMBER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/**
 * Who a decision names as the wake's actor: a member id only. Anything else (`deadline`, an engine actor, an approver the log could not
 * name) stays in the wake's payload, where the decision keeps its `by`, and the actor column is left empty.
 */
export const wakeActorOf = (decision: StopDecision): string | null =>
    decision.kind !== "timeout" && MEMBER_ID.test(decision.by) ? decision.by : null
