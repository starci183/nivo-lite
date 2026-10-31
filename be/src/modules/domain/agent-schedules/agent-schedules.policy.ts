import type { AgentTriggerPreset, AgentTriggerRecord } from "@modules/domain/agent-work"
import type { ModuleTrigger } from "@modules/domain/modules"
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

/** The triggers the module with this key declares for its agent; none when the catalogue has no such module or it declares none. */
export const triggersOfModule = (
    catalog: ReadonlyArray<{ readonly key: string; readonly triggers?: ReadonlyArray<ModuleTrigger> }>,
    moduleKey: string,
): ReadonlyArray<ModuleTrigger> => catalog.find((entry) => entry.key === moduleKey)?.triggers ?? []

/** The most agents one internal fact wakes. */
export const EVENT_WAKE_AGENTS_MAX = 100

/** The key of the wake an internal fact writes for an agent: the event and its business key, so a replay is one wake. */
export const wakeKeyOf = (eventName: string, dedupeKey: string): string => `${eventName}:${dedupeKey}`

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

const DAY_MS = DAY_MINUTES * MINUTE_MS

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const weekdayIn = (ms: number, timeZone: string): number =>
    WEEKDAYS.indexOf(new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date(ms)))

const offsetMinIn = (ms: number, timeZone: string): number => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
    }).formatToParts(new Date(ms))
    const part = (type: string): number => Number(parts.find((candidate) => candidate.type === type)?.value)
    return (
        (Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute")) -
            Math.floor(ms / MINUTE_MS) * MINUTE_MS) /
        MINUTE_MS
    )
}

/** The local weekdays (0 is Sunday) a weekday pattern runs on: Monday to Friday, or Tuesday to Saturday once the spread pushed it past midnight. */
const daysOf = (pattern: string): ReadonlySet<number> =>
    new Set(pattern.endsWith(" 2-6") ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5])

/** The slot one day before another at the same local time, whatever a change of offset did to the day's length. */
const dayBefore = (slot: number, timeZone: string): number => {
    const raw = slot - DAY_MS
    return raw + (offsetMinIn(slot, timeZone) - offsetMinIn(raw, timeZone)) * MINUTE_MS
}

/** The slot of a trigger just before `next`: a day earlier, or for a weekday preset the last day it runs on. */
const slotBefore = (next: Date, trigger: SlotTrigger, agentId: string): number => {
    const schedule = scheduleOf(trigger, agentId)
    if (trigger.preset !== "weekdays_at" || schedule === null) {
        return next.getTime() - periodMsOf(trigger.preset)
    }
    const days = daysOf(schedule.pattern)
    const step = (slot: number): number => {
        const earlier = dayBefore(slot, trigger.timeZone)
        return days.has(weekdayIn(earlier, trigger.timeZone)) ? earlier : step(earlier)
    }
    return step(next.getTime())
}

/** What the slot before the next one needs to know of a trigger. */
type SlotTrigger = Pick<AgentTriggerRecord, "kind" | "atTime" | "timeZone"> & { readonly preset: AgentTriggerPreset }

/**
 * The slot to wake for when a slot was missed: the one the row remembers when it is the only one missed, else the slot just before the
 * next one, so a scheduler lost for days costs one late run and never a replay. For a weekday preset that slot is the last day it runs on
 * (Friday before a Monday), never a weekend day, so the wake key is the key the real fire of that slot would have had.
 */
export const latestMissedSlot = (missed: Date, next: Date, trigger: SlotTrigger, agentId: string): Date =>
    new Date(Math.max(missed.getTime(), slotBefore(next, trigger, agentId)))

/** True when the slot the row remembers is late enough to have been missed. */
export const isMissed = (at: Date, now: Date): boolean => now.getTime() - at.getTime() > MISSED_AFTER_MS
