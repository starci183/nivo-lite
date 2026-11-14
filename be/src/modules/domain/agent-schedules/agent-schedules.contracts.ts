import type { AgentTriggerPreset } from "@modules/domain/agent-work"

/** The next slot a scheduler holds, or none. */
export type NextSlot = Date | null

/** A trigger a module wants on its agent: seeded once per key. */
export interface TriggerSeed {
    /** The stable key. */
    readonly key: string
    /** How often it fires. */
    readonly preset: AgentTriggerPreset
    /** The time of day (`HH:MM`) of a daily preset. */
    readonly atTime?: string | undefined
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

/** The agent that owns a task, with the workspace it lives in. */
export interface TimerOwner {
    /** The workspace the agent lives in. */
    readonly workspaceId: string
    /** The agent that owns the task. */
    readonly agentId: string
}

/** An installation that changed. */
export interface InstallationChange {
    /** The workspace. */
    readonly workspaceId: string
    /** The installation that changed; none when the change touches the whole workspace. */
    readonly installationId?: string
}

/** An agent an event wakes. */
export interface EventTarget {
    /** The agent. */
    readonly agentId: string
}

/** A person who pressed "run now" on a timer, and when. */
export interface TimerPress {
    /** The workspace member who pressed. */
    readonly memberId: string
    /** When, as the engine's clock read it. */
    readonly at: Date
}
