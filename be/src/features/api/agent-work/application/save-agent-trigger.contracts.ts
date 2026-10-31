import type { AgentTriggerKind, AgentTriggerPreset } from "@modules/domain/agent-work"

/** What add or change a trigger of an agent takes. */
export interface SaveAgentTriggerRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The agent instance. */
    readonly installationId: string
    /** The trigger to change; null for a new one. */
    readonly triggerId: string | null
    /** Clock or event. */
    readonly kind: AgentTriggerKind
    /** The schedule preset, for a clock. */
    readonly preset: AgentTriggerPreset | null
    /** The time of day (HH:MM), for the daily presets. */
    readonly atTime: string | null
    /** The zone of the time of day; the default zone when null. */
    readonly timeZone: string | null
    /** The internal event, for an event trigger. */
    readonly eventName: string | null
    /** The probe that decides whether there is work. */
    readonly probeKey: string | null
    /** Off keeps the trigger and fires nothing. */
    readonly enabled: boolean
}
