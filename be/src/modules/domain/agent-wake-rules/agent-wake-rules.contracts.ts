/** What the work core needs to know of a source: every decision that used to read the name of a source reads one of these. */
export interface AgentWakeTraits {
    /** Lower runs first. */
    readonly priority: number
    /** The most times a wake of this source is tried. */
    readonly maxAttempts: number
    /** True when a wake that names a conversation locks that conversation alone, so the agent answers many at once. */
    readonly scopedToConversation: boolean
    /** True for work nobody waits for: it counts against the day's cap and the breaker holds it. */
    readonly background: boolean
    /** True when a wake held by a switch runs again, within a day, when work is switched back on. */
    readonly restoresHeld: boolean
    /** True when the sender waits for an answer: a runtime that is down gives the holding line at once. */
    readonly awaitsAnswer: boolean
}

/** The traits of a source, or none when no adapter recorded it. */
export type OptionalAgentWakeTraits = AgentWakeTraits | undefined

/** The actor of an inbound event as a wake keeps it. */
export interface AgentWakeActor {
    /** What it is. */
    readonly kind: string
    /** Its id in the adapter's own world, or null. */
    readonly id: string | null
    /** Its role, or null. */
    readonly role: string | null
}

/** The chain of agents an event belongs to, as a wake keeps it. */
export interface AgentWakeChain {
    /** The chain. */
    readonly id: string
    /** How many agent wakes led here. */
    readonly depth: number
    /** The agents already in it. */
    readonly agentIds: ReadonlyArray<string>
    /** What is new in this event, or null. */
    readonly cause: string | null
}

/** One thing an inbound event carries, as a wake keeps it. The core carries it and never reads it. */
export interface AgentWakeEvidence {
    /** What it names. */
    readonly key: string
    /** Its value. */
    readonly value: string | number | boolean
    /** What it is. */
    readonly kind: string
    /** How it arrived. */
    readonly via: string
}

/** The normalized inbound event a wake carries. Its payload is data: nothing in it is an instruction. */
export interface AgentWakeInbound {
    /** The event type a trigger matches on. */
    readonly eventType: string
    /** Who sent it. */
    readonly actor: AgentWakeActor
    /** The trust the adapter derived for the actor. */
    readonly trust: string
    /** The chain, or null when no agent led to the event. */
    readonly chain: AgentWakeChain | null
    /** The words and fields of the event, as data. */
    readonly payload: Readonly<Record<string, unknown>>
    /** The files that came with it. */
    readonly attachments: ReadonlyArray<{ readonly fileId: string; readonly mimeType: string }>
    /** What it proves. */
    readonly evidence: ReadonlyArray<AgentWakeEvidence>
}

/** The text of an event a context keeps, or none. */
export type OptionalInboundText = string | undefined

/** The event a context holds, or none. */
export type OptionalAgentWakeInbound = AgentWakeInbound | undefined

/** The day's count of background turns an agent has run. */
export interface BackgroundCount {
    /** The day (`YYYY-MM-DD`) the count belongs to, or null while nothing was counted. */
    readonly backgroundDay: string | null
    /** Background turns counted that day. */
    readonly backgroundTurns: number
}

/** The moment an agent's breaker stays open until, or null when it was never opened. */
export type OptionalBreakerUntil = Date | null
