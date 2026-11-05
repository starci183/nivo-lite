import type { AgentGoalStatus, AgentTriggerKind, AgentTriggerPreset } from "./agent-work.contracts"

/** What an owner or manager writes for a goal of the agent of an instance. */
export interface AgentGoalDraft {
    /** The workspace the caller names. */
    readonly workspaceId: string
    /** The agent instance. */
    readonly installationId: string
    /** The goal to change, or null for a new one. */
    readonly goalId: string | null
    /** Short title. */
    readonly title: string
    /** Longer text. */
    readonly detail: string
    /** Where it stands. */
    readonly status: AgentGoalStatus
    /** When it is due, or null. */
    readonly dueAt: Date | null
}

/** What an owner or manager writes for a trigger of the agent of an instance. */
export interface AgentTriggerDraft {
    /** The workspace the caller names. */
    readonly workspaceId: string
    /** The agent instance. */
    readonly installationId: string
    /** The trigger to change, or null for a new one. */
    readonly triggerId: string | null
    /** Clock or event. */
    readonly kind: AgentTriggerKind
    /** The schedule preset, for a clock. */
    readonly preset: AgentTriggerPreset | null
    /** The time of day (HH:MM), for the daily presets. */
    readonly atTime: string | null
    /** The zone of the time of day; the default when null. */
    readonly timeZone: string | null
    /** The internal event, for an event trigger. */
    readonly eventName: string | null
    /** The probe that decides whether there is work. */
    readonly probeKey: string | null
    /** Off keeps the trigger and fires nothing. */
    readonly enabled: boolean
}
