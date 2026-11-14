import { WAKE_SOURCE_KEY } from "@modules/domain/agent-wake-rules"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import type { AgentTriggerKind, AgentTriggerPreset, AgentTriggerWrite } from "./agent-work.contracts"

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/

/** What a validated trigger writes to its row. */
export interface TriggerFields {
    /** Clock or event. */
    readonly kind: AgentTriggerKind
    /** The preset of a clock, else null. */
    readonly preset: AgentTriggerPreset | null
    /** The time of day of a daily preset, else null. */
    readonly atTime: string | null
    /** The zone of the time of day. */
    readonly timeZone: string
    /** The event of an event trigger, else null. */
    readonly eventName: string | null
    /** The probe, or null. */
    readonly probeKey: string | null
    /** Off means the trigger fires nothing. */
    readonly enabled: boolean
    /** The sources an event trigger answers to; none for a clock, empty for every source. */
    readonly sources: Array<string>
}

/** The most sources one event trigger may name. */
export const TRIGGER_SOURCES_MAX = 10

const needsTime = (preset: AgentTriggerPreset): boolean => preset === "daily_at" || preset === "weekdays_at"

const shapeInvalid = (): AgentWorkError => new AgentWorkError({ code: AgentWorkErrorCode.TriggerShapeInvalid })

const clockFields = (write: AgentTriggerWrite, preset: AgentTriggerPreset, workspaceZone: string): TriggerFields => {
    if (write.eventName !== null) throw shapeInvalid()
    if (needsTime(preset) && (write.atTime === null || !TIME_OF_DAY.test(write.atTime))) {
        throw new AgentWorkError({ code: AgentWorkErrorCode.TimeInvalid })
    }
    return {
        kind: "schedule",
        preset,
        atTime: needsTime(preset) ? write.atTime : null,
        timeZone: write.timeZone ?? workspaceZone,
        eventName: null,
        probeKey: write.probeKey,
        enabled: write.enabled,
        sources: [],
    }
}

/**
 * Checks a trigger the owner wrote and answers the fields its row keeps: a clock needs a preset (and a time for the daily ones), an event
 * needs its name, and never both. A trigger that names no zone takes the workspace's own (`workspaceZone`, the workspace setting).
 */
export const triggerFields = (write: AgentTriggerWrite, workspaceZone: string): TriggerFields => {
    if (write.kind === "schedule") {
        if (write.preset === null) throw shapeInvalid()
        return clockFields(write, write.preset, workspaceZone)
    }
    if (write.eventName === null || write.eventName === "" || write.preset !== null) throw shapeInvalid()
    const sources = [...new Set(write.sources ?? [])]
    if (sources.length > TRIGGER_SOURCES_MAX || sources.some((source) => !WAKE_SOURCE_KEY.test(source))) {
        throw shapeInvalid()
    }
    return {
        kind: "event",
        preset: null,
        atTime: null,
        timeZone: write.timeZone ?? workspaceZone,
        eventName: write.eventName,
        probeKey: write.probeKey,
        enabled: write.enabled,
        sources,
    }
}
