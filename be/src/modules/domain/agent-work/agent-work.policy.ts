import { wakeSources } from "./agent-wake-source.policy"
import type { AgentBurstWindow } from "./agent-work.port"
import type { AgentWakeContext, AgentWakeSource, AgentWakeStatus } from "./agent-work.contracts"
import type { AgentWakeSettle } from "./agent-wake-settle.contracts"

/** The runtime session key of an agent's turn: the thread key and the agent, so agents that share a runtime agent never share a session. */
export const sessionKeyOf = (threadKey: string, agentId: string): string => `${threadKey}:${agentId}`

/** The scope of work that locks the whole agent: tags, internal events and schedules. */
export const AGENT_SCOPE = "agent"

/** The start of the scope key of a customer conversation. */
export const CONVERSATION_SCOPE_PREFIX = "conversation:"

/** The lease of a running turn, in seconds; the heartbeat renews it. */
export const LEASE_SECONDS = 90

/** How often the heartbeat renews the lease, in milliseconds. */
export const HEARTBEAT_MS = 30_000

/** The most beats of the heartbeat one turn gets (ten minutes): past it the lease is left to lapse, so a hung turn cannot hold its scope forever. */
export const HEARTBEAT_MAX_BEATS = 20

/** Failed turns in a row that open the breaker. */
export const BREAKER_AFTER = 5

/** How long the breaker stays open, in seconds. */
export const BREAKER_SECONDS = 900

/** The most triggers one agent may have. */
export const MAX_TRIGGERS = 8

/** The earliest an agent may ask to be woken again for a task, in milliseconds from now. */
export const TASK_WAKE_MIN_MS: number = 5 * 60_000

/** The latest an agent may ask to be woken again for a task, in milliseconds from now. */
export const TASK_WAKE_MAX_MS: number = 7 * 24 * 60 * 60_000

/** How old a held customer or tag wake may be and still run when work is switched back on, in milliseconds. */
export const RESTORE_WINDOW_MS: number = 24 * 60 * 60_000

/** How long a wake that was skipped is kept, in milliseconds. */
export const SKIPPED_WAKE_RETENTION_MS: number = 2 * 24 * 60 * 60_000

/** How long any other ended wake is kept, in milliseconds. */
export const WAKE_RETENTION_MS: number = 30 * 24 * 60 * 60_000

/** How long the lease row of an idle customer conversation is kept, in milliseconds. */
export const IDLE_LEASE_RETENTION_MS: number = 2 * 24 * 60 * 60_000

/** The priority of a wake of this source. */
export const priorityOf = (source: AgentWakeSource): number => wakeSources.of(source).priority

/** The attempts a wake of this source may have. */
export const attemptBudgetOf = (source: AgentWakeSource): number => wakeSources.of(source).maxAttempts

/** The wait in seconds before the next try of a wake that failed on this attempt (1 is the first try): 1, 5 and 15 minutes, 15 for any later one. */
export const retryWaitOf = (attempt: number): number => {
    if (attempt <= 1) return 60
    return attempt === 2 ? 300 : 900
}

/** The lock scope of a wake: a source that answers inside a conversation locks that conversation by itself, everything else locks the agent. */
export const scopeKeyOf = (source: AgentWakeSource, context: AgentWakeContext): string =>
    wakeSources.of(source).scopedToConversation && context.conversationId !== undefined
        ? `${CONVERSATION_SCOPE_PREFIX}${context.conversationId}`
        : AGENT_SCOPE

/** The next action time of a task, kept between five minutes and seven days ahead of now. */
export const boundedWakeAt = (requested: Date, now: Date): Date => {
    const earliest = now.getTime() + TASK_WAKE_MIN_MS
    const latest = now.getTime() + TASK_WAKE_MAX_MS
    return new Date(Math.min(Math.max(requested.getTime(), earliest), latest))
}

/** Whether a wake held by a switch runs again when work is switched back on: a source that restores, written less than a day ago. */
export const restoresHeldWake = (source: AgentWakeSource, createdAt: Date, now: Date): boolean =>
    wakeSources.lookup(source)?.restoresHeld === true && now.getTime() - createdAt.getTime() < RESTORE_WINDOW_MS

/** True when the sender of a wake of this source waits for an answer, so a runtime that is down gets the holding line at once. */
export const awaitsAnswer = (source: AgentWakeSource): boolean => wakeSources.lookup(source)?.awaitsAnswer === true

/** Where a wake stands in the words of a job's state: waiting (pending or held by a switch), running, done (answered or skipped) or failed (dead). */
export const wakeProgressOf = (status: AgentWakeStatus): "queued" | "running" | "done" | "failed" => {
    if (status === "running") return "running"
    if (status === "done" || status === "skipped") return "done"
    return status === "failed" || status === "dead" ? "failed" : "queued"
}

/**
 * The source a follow-up drain is keyed under: a drain that came before its conversation's burst window ended schedules one more
 * for the time the database says is left. It is a word of the job's dedupe key only; no wake has this source.
 */
export const REARM_SOURCE = "rearm"

/**
 * The most follow-up drains one chain may schedule. Each waits out what the database says is left, so one is enough unless the
 * clocks move again while it waits; past this many the wake is left to the minute sweep, so a clock that never settles cannot keep
 * a chain of jobs alive.
 */
export const REARM_MAX_HOPS = 5

/** The shortest wait of a follow-up drain, milliseconds: a wait of a few milliseconds is not turned into a job that comes back at once. */
export const REARM_MIN_WAIT_MS = 250

/** How many follow-ups led to this drain: what its payload carries, none for the drain a wake, a finished turn or the sweep started. */
export const rearmHopOf = (payload: object): number => {
    const hop: unknown = "rearm" in payload ? payload.rearm : 0
    return typeof hop === "number" && Number.isInteger(hop) && hop > 0 ? hop : 0
}

/**
 * The fact a follow-up drain is deduplicated on: the scope, the wake the wait is for and the hop. Every drain of a burst that waits
 * for the same newest message at the same hop asks for the same follow-up, so the burst gets one; a follow-up that itself came
 * early asks for the next hop, which is a new job.
 */
export const rearmEventKeyOf = (scopeKey: string, wakeId: string, hop: number): string =>
    `${scopeKey}:${wakeId}:${String(hop)}`

/** How long a follow-up drain waits: what the database said is left, never under the floor. */
export const rearmWaitMsOf = (waitMs: number): number => Math.max(REARM_MIN_WAIT_MS, Math.ceil(waitMs))

/**
 * The window and the longest wait of a wake's settle time (its source's declaration): the longest wait is never shorter than the window,
 * and a declaration that names none waits no longer than the window.
 */
export const burstFor = (settle: AgentWakeSettle): AgentBurstWindow => {
    const windowMs = Math.max(0, settle.windowMs)
    return { windowMs, maxWaitMs: Math.max(windowMs, settle.maxWaitMs ?? windowMs) }
}
