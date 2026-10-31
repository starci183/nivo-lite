import { DEFAULT_TIME_ZONE } from "./agent-work.policy"
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
}

const needsTime = (preset: AgentTriggerPreset): boolean => preset === "daily_at" || preset === "weekdays_at"

const shapeInvalid = (): AgentWorkError => new AgentWorkError({ code: AgentWorkErrorCode.TriggerShapeInvalid })

const clockFields = (write: AgentTriggerWrite, preset: AgentTriggerPreset): TriggerFields => {
    if (write.eventName !== null) throw shapeInvalid()
    if (needsTime(preset) && (write.atTime === null || !TIME_OF_DAY.test(write.atTime))) {
        throw new AgentWorkError({ code: AgentWorkErrorCode.TimeInvalid })
    }
    return {
        kind: "schedule",
        preset,
        atTime: needsTime(preset) ? write.atTime : null,
        timeZone: write.timeZone ?? DEFAULT_TIME_ZONE,
        eventName: null,
        probeKey: write.probeKey,
        enabled: write.enabled,
    }
}

/** Checks a trigger the owner wrote and answers the fields its row keeps: a clock needs a preset (and a time for the daily ones), an event needs its name, and never both. */
export const triggerFields = (write: AgentTriggerWrite): TriggerFields => {
    if (write.kind === "schedule") {
        if (write.preset === null) throw shapeInvalid()
        return clockFields(write, write.preset)
    }
    if (write.eventName === null || write.eventName === "" || write.preset !== null) throw shapeInvalid()
    return {
        kind: "event",
        preset: null,
        atTime: null,
        timeZone: write.timeZone ?? DEFAULT_TIME_ZONE,
        eventName: write.eventName,
        probeKey: write.probeKey,
        enabled: write.enabled,
    }
}
