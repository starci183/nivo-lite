import type { useFormatter, useTranslations } from "next-intl"
import type { InstallationLifecycle } from "@/modules/installations"
import type { AgentWorkPreset } from "@/modules/types"

/** The translator of the Work tab. */
export type AgentWorkTranslator = ReturnType<typeof useTranslations<"agentWork">>

/** The formatter of dates and relative times. */
export type AgentWorkFormatter = ReturnType<typeof useFormatter>

/** How often the tab asks again while a turn runs, in milliseconds. */
export const WORK_POLL_BUSY_MS = 5000

/** How often the tab asks again otherwise, in milliseconds. */
export const WORK_POLL_IDLE_MS = 30000

/** The longest title of a goal, as the back end accepts it. */
export const GOAL_TITLE_MAX = 200

/** The time zone a new clock trigger is written in. */
export const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The presets a person can pick for a clock trigger, in the order the form lists them. */
export const WORK_PRESETS: ReadonlyArray<AgentWorkPreset> = ["every_15m", "hourly", "daily_at", "weekdays_at"]

/** True when a preset runs at a time of day. */
export const presetNeedsTime = (preset: AgentWorkPreset): boolean => preset === "daily_at" || preset === "weekdays_at"

/** A time of day as the back end reads it: HH:MM. */
export const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/

/** The state of an agent as the back end sends it. */
export interface StateWire {
    readonly workEnabled: boolean
    readonly breakerUntil: unknown
}

/** One goal as the back end sends it. */
export interface GoalWire {
    readonly id: string
    readonly title: string
    readonly detail: string
    readonly status: string
    readonly source: string
    readonly dueAt: unknown
}

/** One task as the back end sends it. */
export interface TaskWire {
    readonly id: string
    readonly title: string
    readonly detail: string
    readonly status: string
    readonly waitingOn: string | null | undefined
    readonly nextActionAt: unknown
    readonly workItemId: string | null | undefined
}

/** One trigger as the back end sends it. */
export interface TriggerWire {
    readonly id: string
    readonly kind: string
    readonly preset: string | null | undefined
    readonly atTime: string | null | undefined
    readonly timeZone: string
    readonly eventName: string | null | undefined
    readonly probeKey: string | null | undefined
    readonly enabled: boolean
    readonly seedKey: string | null | undefined
    readonly nextRunAt: unknown
}

/** One turn as the back end sends it. */
export interface TurnWire {
    readonly id: string
    readonly source: string
    readonly wakeStatus: string
    readonly reason: string | null | undefined
    readonly status: string
    readonly promptTokens: number | null | undefined
    readonly completionTokens: number | null | undefined
    readonly cost: number | null | undefined
    readonly durationMs: number | null | undefined
    readonly workItemId: string | null | undefined
    readonly wokeAt: unknown
}

/** What the `agentWork` query answers. */
export interface AgentWorkWire {
    readonly state: StateWire
    readonly goals: ReadonlyArray<GoalWire>
    readonly tasks: ReadonlyArray<TaskWire>
    readonly triggers: ReadonlyArray<TriggerWire>
    readonly turns: ReadonlyArray<TurnWire>
    readonly pendingWakes: number
}

/** What the words of the tab need besides the wire: the clock, the lifecycle and the workspace switch. */
export interface AgentWorkContext {
    readonly t: AgentWorkTranslator
    readonly format: AgentWorkFormatter
    /** The moment the data was answered, so a relative time reads against it. */
    readonly now: number
    /** The one state of the installation (the lifecycle the back end names); null until it is read. */
    readonly lifecycle: InstallationLifecycle | null
    /** That state in words: the label every other screen shows for it. */
    readonly lifecycleLabel: string
    /** The whole workspace has work switched off. */
    readonly isWorkspaceOff: boolean
    readonly canEdit: boolean
    /** Where a work item is decided. */
    readonly hrefOfWorkItem: (workItemId: string) => string
}

const PRESET_SET: ReadonlySet<string> = new Set<string>(WORK_PRESETS)

/** The preset a text names; none for a text outside the closed set. */
export const presetOf = (text: string | null | undefined): AgentWorkPreset | null => {
    if (text === null || text === undefined || !PRESET_SET.has(text)) return null
    return WORK_PRESETS.find((preset) => preset === text) ?? null
}

/** The moment a text names in milliseconds; none for a missing or unreadable text. */
export const dateOf = (text: unknown): number | null => {
    if (typeof text !== "string") return null
    const parsed = Date.parse(text)
    return Number.isNaN(parsed) ? null : parsed
}

/** A moment in words against the moment the data was answered ("in 12 minutes"); empty when there is none. */
export const relative = (context: AgentWorkContext, text: unknown): string => {
    const at = dateOf(text)
    return at === null ? "" : context.format.relativeTime(at, context.now)
}

/** Where a work item is decided, when the wire names one. */
export const workItemHrefOf = (context: AgentWorkContext, id: string | null | undefined): string | null =>
    id === null || id === undefined ? null : context.hrefOfWorkItem(id)
