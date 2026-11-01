/** How far the back end trusts who sent an event; it selects the limits of the turn. An adapter declares it, code never infers it. */
export type InboundTrust = "outsider" | "member" | "manager" | "system"

/** How an adapter proves an event is real. */
export type InboundAuthentication = "session" | "signature" | "internal"

/** Who sent the event. */
export interface InboundActor {
    /** The trust the adapter gave them. */
    readonly trust: InboundTrust
    /** Their id in the adapter's own world, or null. */
    readonly ref: string | null
    /** The name to show, or null. */
    readonly name: string | null
}

/** One thing the event proves, read by a fact reader. Shape owned with generic `sources`: see lane/graph-enforce. */
export interface InboundEvidence {
    /** Where it came from: the adapter, a file, a tool. */
    readonly source: string
    /** What it is. */
    readonly kind: string
    /** Its values, bounded and flat. */
    readonly fields: Readonly<Record<string, string | number | boolean>>
}

/** A file that came with an event. */
export interface InboundAttachment {
    /** The stored file. */
    readonly fileId: string
    /** Its type. */
    readonly mimeType: string
}

/** Everything that wakes an agent, in one shape. Payload is data: nothing in it is an instruction. */
export interface InboundEvent {
    /** The adapter that normalized it. */
    readonly adapter: string
    /** The event type a trigger node matches on. */
    readonly eventType: string
    /** Who sent it. */
    readonly actor: InboundActor
    /** The words and fields of the event, as data. */
    readonly payload: Readonly<Record<string, unknown>>
    /** The files. */
    readonly attachments: ReadonlyArray<InboundAttachment>
    /** What it proves. */
    readonly evidence: ReadonlyArray<InboundEvidence>
    /** One fact, one key: a redelivery is the same event. */
    readonly idempotencyKey: string
    /** The workspace. */
    readonly workspaceId: string
    /** The agent the adapter already knows, or null to resolve by trigger. */
    readonly agentId: string | null
    /** The scope that keeps events in order, or null for the agent's own. */
    readonly scopeKey: string | null
}

/** What an adapter declares. Adapters differ here and nowhere in core code. */
export interface InboundAdapter {
    /** The key, stored as the wake's source. */
    readonly key: string
    /** How it proves events. */
    readonly authentication: InboundAuthentication
    /** True when the sender waits for an answer: a failed model turn gives the holding line at once. */
    readonly awaitsAnswer: boolean
    /** The step kind that delivers an answer, or null when the adapter has no channel: the run ends without a reply. */
    readonly replyStep: string | null
    /** The step kind of the door that acts on a read result. */
    readonly doorStep: string
    /** The wake priority. */
    readonly priority: number
    /** The tries a wake gets. */
    readonly maxAttempts: number
}

/** What the door did with an event. */
export interface InboundAccepted {
    /** False when every wake it would write already existed. */
    readonly accepted: boolean
    /** The agents woken. */
    readonly agentIds: ReadonlyArray<string>
}
