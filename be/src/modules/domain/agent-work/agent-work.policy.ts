import type { AgentWakeContext, AgentWakeSource, BackgroundCount } from "./agent-work.contracts"

/** The scope of work that locks the whole agent: tags, internal events and schedules. */
export const AGENT_SCOPE = "agent"

const CONVERSATION_PREFIX = "conversation:"

/** Lower runs first: a customer waits on a phone, a colleague in Office, an event or a clock can wait. */
const PRIORITIES: Readonly<Record<AgentWakeSource, number>> = { customer: 10, tag: 20, internal: 30, schedule: 40 }

/** The most times a wake is tried: a customer gets a second try for a crash only, everything else three. */
const ATTEMPT_BUDGETS: Readonly<Record<AgentWakeSource, number>> = { customer: 2, tag: 3, internal: 3, schedule: 3 }

/** The lease of a running turn, in seconds; the heartbeat renews it. */
export const LEASE_SECONDS = 90

/** How often the heartbeat renews the lease, in milliseconds. */
export const HEARTBEAT_MS = 30_000

/** Failed turns in a row that open the breaker. */
export const BREAKER_AFTER = 5

/** How long the breaker stays open, in seconds. */
export const BREAKER_SECONDS = 900

/** The most triggers one agent may have. */
export const MAX_TRIGGERS = 8

/** The earliest an agent may ask to be woken again for a task, in milliseconds from now. */
export const TASK_WAKE_MIN_MS = 5 * 60_000

/** The latest an agent may ask to be woken again for a task, in milliseconds from now. */
export const TASK_WAKE_MAX_MS = 7 * 24 * 60 * 60_000

/** How old a held customer or tag wake may be and still run when work is switched back on, in milliseconds. */
export const RESTORE_WINDOW_MS = 24 * 60 * 60_000

/** How long a wake that was skipped is kept, in milliseconds. */
export const SKIPPED_WAKE_RETENTION_MS = 2 * 24 * 60 * 60_000

/** How long any other ended wake is kept, in milliseconds. */
export const WAKE_RETENTION_MS = 30 * 24 * 60 * 60_000

/** The default time zone of a schedule. */
export const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The priority of a wake of this source. */
export const priorityOf = (source: AgentWakeSource): number => PRIORITIES[source]

/** The attempts a wake of this source may have. */
export const attemptBudgetOf = (source: AgentWakeSource): number => ATTEMPT_BUDGETS[source]

/** The wait in seconds before the next try of a wake that failed on this attempt (1 is the first try): 1, 5 and 15 minutes, 15 for any later one. */
export const retryWaitOf = (attempt: number): number => {
    if (attempt <= 1) return 60
    return attempt === 2 ? 300 : 900
}

/** The lock scope of a wake: a customer conversation locks by itself, everything else locks the agent. */
export const scopeKeyOf = (source: AgentWakeSource, context: AgentWakeContext): string =>
    source === "customer" && context.conversationId !== undefined
        ? `${CONVERSATION_PREFIX}${context.conversationId}`
        : AGENT_SCOPE

/** The next action time of a task, kept between five minutes and seven days ahead of now. */
export const boundedWakeAt = (requested: Date, now: Date): Date => {
    const earliest = now.getTime() + TASK_WAKE_MIN_MS
    const latest = now.getTime() + TASK_WAKE_MAX_MS
    return new Date(Math.min(Math.max(requested.getTime(), earliest), latest))
}

/** True for a wake that is background work: nobody waits for its answer, so it counts against the day's cap. */
export const isBackground = (source: AgentWakeSource): boolean => source === "internal" || source === "schedule"

/** Whether a wake held by a switch runs again when work is switched back on: a customer or a tag, written less than a day ago. */
export const restoresHeldWake = (source: AgentWakeSource, createdAt: Date, now: Date): boolean =>
    (source === "customer" || source === "tag") && now.getTime() - createdAt.getTime() < RESTORE_WINDOW_MS

/** Whether the background cap of the day is spent; a count of another day is not. */
export const backgroundCapSpent = (state: BackgroundCount, cap: number, today: string): boolean =>
    state.backgroundDay === today && state.backgroundTurns >= cap

/** Whether the breaker is open at this moment. */
export const breakerOpen = (breakerUntil: Date | null, now: Date): boolean =>
    breakerUntil !== null && breakerUntil.getTime() > now.getTime()
