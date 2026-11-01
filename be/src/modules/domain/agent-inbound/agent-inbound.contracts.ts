import type { InboundTrust } from "@modules/domain/intent-contracts"

/** How an adapter proves an event is real. */
export type InboundAuthentication = "session" | "signature" | "internal"

/** Who sent the event, as the adapter declares it. Trust is derived from it; a plug-in decides what the actor may do. */
export interface InboundActor {
    /** What it is: a member, an agent, a system, an outsider. An adapter may declare another. */
    readonly kind: string
    /** Its id in the adapter's own world, or null. */
    readonly id: string | null
    /** Its role, or null when it has none. */
    readonly role: string | null
}

/** One thing the event carries. The core carries it and never reads it: a fact reader reads entries by key. */
export interface InboundEvidence {
    /** What it names. */
    readonly key: string
    /** Its value. */
    readonly value: string | number | boolean
    /** What it is. */
    readonly kind: string
    /** How it arrived: the adapter, a file, a tool. */
    readonly via: string
}

/** The chain of agents an event belongs to, so a tag between agents cannot run for ever. */
export interface InboundChain {
    /** The chain. */
    readonly id: string
    /** How many agent wakes led here. */
    readonly depth: number
    /** The agents already in it. */
    readonly agentIds: ReadonlyArray<string>
    /** What is new in this event, or null: an agent in the chain is woken again only for a new cause. */
    readonly cause: string | null
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
    /** The chain it belongs to, or null when no agent led to it. */
    readonly chain: InboundChain | null
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
    /** The trust of an actor of this adapter. */
    trustOf(actor: InboundActor): InboundTrust
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
