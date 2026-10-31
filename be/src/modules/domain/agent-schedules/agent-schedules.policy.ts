import type { AgentTriggerPreset, AgentTriggerRecord } from "@modules/domain/agent-work"
import type { QueueSchedule } from "@modules/platform/queue"

const MINUTE_MS = 60_000

/** The most things of each kind one pass of the minute sweep handles, so a backlog never makes a pass long. */
export const SWEEP_LIMIT = 200

/** The most wakes one pass removes past retention, of each kind. */
export const RETENTION_BATCH = 500

/** How long a probe may take before the wake is skipped, in milliseconds. */
export const PROBE_BUDGET_MS = 2000

/** How late a slot must be before the sweep treats it as missed; the database function uses the same two minutes. */
export const MISSED_AFTER_MS = 2 * MINUTE_MS

/** How far back the probes of money and documents look, in milliseconds. */
export const PROBE_WINDOW_MS = 24 * 60 * MINUTE_MS

/** The most items a probe names in its brief. */
export const BRIEF_ITEMS = 5

/** The shortest time between two fires of a trigger, in minutes. */
export const MIN_PERIOD_MINUTES = 15

const PERIODS: Readonly<Record<AgentTriggerPreset, number>> = {
    every_15m: MIN_PERIOD_MINUTES,
    hourly: 60,
    daily_at: 24 * 60,
    weekdays_at: 24 * 60,
}

const DAY_MINUTES = 24 * 60

/** The time between two fires of a preset, in milliseconds. */
export const periodMsOf = (preset: AgentTriggerPreset): number => PERIODS[preset] * MINUTE_MS

/** A stable spread of agents over the first quarter hour: the minute added to the owner's time, so a thousand 08:00 agents do not fire in one second. */
export const offsetMinutesOf = (agentId: string): number => {
    let hash = 0
    for (const char of agentId) hash = (hash * 31 + Number(char.codePointAt(0))) % 997
    return hash % MIN_PERIOD_MINUTES
}

const TIME_OF_DAY = /^(\d{2}):(\d{2})$/u

const dailyOf = (atTime: string | null, offset: number): { minute: number; hour: number; wrapped: boolean } | null => {
    const parts = atTime === null ? null : TIME_OF_DAY.exec(atTime)
    if (parts === null) return null
    const total = Number(parts[1]) * 60 + Number(parts[2]) + offset
    const inDay = total % DAY_MINUTES
    return { minute: inDay % 60, hour: Math.floor(inDay / 60), wrapped: total >= DAY_MINUTES }
}

const weekdaysOf = (wrapped: boolean): string => (wrapped ? "2-6" : "1-5")

/**
 * The cron pattern and zone of a clock trigger for an agent, or null when the row says nothing a clock can run (an event, a daily
 * preset with no time). The pattern is built from the preset, never read from free text, so no parser is needed. The agent's spread
 * minute is added to the owner's time; a daily time pushed past midnight moves its weekdays on by one.
 */
export const scheduleOf = (
    trigger: Pick<AgentTriggerRecord, "kind" | "preset" | "atTime" | "timeZone">,
    agentId: string,
): QueueSchedule | null => {
    if (trigger.kind !== "schedule" || trigger.preset === null) return null
    const offset = offsetMinutesOf(agentId)
    const tz = trigger.timeZone
    if (trigger.preset === "every_15m") {
        const minutes = [0, 1, 2, 3].map((quarter) => offset + quarter * MIN_PERIOD_MINUTES).join(",")
        return { pattern: `${minutes} * * * *`, tz }
    }
    if (trigger.preset === "hourly") return { pattern: `${String(offset)} * * * *`, tz }
    const daily = dailyOf(trigger.atTime, offset)
    if (daily === null) return null
    const days = trigger.preset === "weekdays_at" ? weekdaysOf(daily.wrapped) : "*"
    return { pattern: `${String(daily.minute)} ${String(daily.hour)} * * ${days}`, tz }
}

/**
 * The slot to wake for when a slot was missed: the one the row remembers when it is the only one missed, else the slot just before the
 * next one, so a scheduler lost for days costs one late run and never a replay.
 */
export const latestMissedSlot = (missed: Date, next: Date, preset: AgentTriggerPreset): Date =>
    new Date(Math.max(missed.getTime(), next.getTime() - periodMsOf(preset)))

/** True when the slot the row remembers is late enough to have been missed. */
export const isMissed = (at: Date, now: Date): boolean => now.getTime() - at.getTime() > MISSED_AFTER_MS
