import type { AgentTriggerPreset } from "@modules/domain/agent-work"

/** The next slot a scheduler holds, or none. */
export type NextSlot = Date | null

/** The agent a probe looks at: ids only. */
export interface ProbeAgent {
    /** The workspace of the agent. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
}

/** What a probe found: nothing to do, or work with the brief the turn starts from. */
export type ProbeAnswer =
    | { readonly work: false }
    | { readonly work: true; readonly brief: string; readonly subjectIds: ReadonlyArray<string> }

/** A read-only check of whether a schedule or an event has work for the agent; it is the reason a quiet clock costs no model call. */
export interface AgentProbe {
    /** The key a trigger names it by. */
    readonly key: string
    /** Looks and answers; it writes nothing. */
    check(agent: ProbeAgent): Promise<ProbeAnswer>
}

/** What the probes decided for one wake. */
export type ProbeDecision =
    | { readonly kind: "run"; readonly brief: string | null; readonly subjectIds: ReadonlyArray<string> }
    | { readonly kind: "skip"; readonly reason: "no_work" | "no_probe" | "probe_failed" }

/** A trigger a module wants on its agent: seeded once per key. */
export interface TriggerSeed {
    /** The stable key. */
    readonly key: string
    /** How often it fires. */
    readonly preset: AgentTriggerPreset
    /** The time of day (`HH:MM`) of a daily preset. */
    readonly atTime?: string | undefined
    /** The probe that decides whether a fire has work. */
    readonly probeKey?: string | undefined
}

/** What one pass of the minute sweep did. */
export interface SweepReport {
    /** Drains started for a lapsed lease or a due wake. */
    readonly drains: number
    /** Wakes written for tasks that fell due. */
    readonly tasks: number
    /** Schedulers made true to their rows. */
    readonly triggers: number
    /** Wakes written for a missed slot. */
    readonly missed: number
    /** Wakes removed past retention. */
    readonly removed: number
}

/** The delivery of an event a reactor claims in the inbox: its queue and the business key of the fact. */
export interface EventClaim {
    /** The reactor's queue, the first half of the inbox key. */
    readonly consumer: string
    /** The business key of the fact, the second half. */
    readonly dedupeKey: string
}

/** One internal fact that may wake agents. */
export interface InternalEventFact {
    /** The workspace the fact belongs to. */
    readonly workspaceId: string
    /** The event name an event trigger names. */
    readonly eventName: string
    /** The business key of the fact: a replay of it is one wake. */
    readonly dedupeKey: string
    /** The record the fact is about. */
    readonly subjectId: string
}

/** An installation that changed. */
export interface InstallationChange {
    /** The workspace. */
    readonly workspaceId: string
    /** The installation that changed; none when the change touches the whole workspace. */
    readonly installationId?: string
}

/** An agent an event wakes, and the probe of the trigger that matched. */
export interface EventTarget {
    /** The agent. */
    readonly agentId: string
    /** The probe of the trigger, or null. */
    readonly probeKey: string | null
}

/** A person who pressed "run now" on a timer, and when. */
export interface TimerPress {
    /** The workspace member who pressed. */
    readonly memberId: string
    /** When, as the engine's clock read it. */
    readonly at: Date
}

/** The agent a care timer belongs to, in its workspace. */
export interface CareTimerOwner {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent that holds the timer. */
    readonly agentId: string
}
