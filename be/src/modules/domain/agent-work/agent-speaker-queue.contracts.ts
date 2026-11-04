import type { AgentLocale } from "./agent-work.contracts"
import type { AgentTagVisibility } from "./agent-tag.contracts"

/** A hand-off of one agent to another that waits for the right to speak in its conversation, as the tag door took it. */
export interface QueuedTag {
    /** The workspace of both agents. */
    readonly workspaceId: string
    /** The agent that handed off. */
    readonly fromAgentId: string
    /** The agent the hand-off is for. */
    readonly toAgentId: string
    /** What the tagger said. */
    readonly text: string
    /** The conversation whose right to speak the hand-off waits for. */
    readonly conversationId: string
    /** The tag's event key: the wake is written once. */
    readonly eventKey: string
    /** The record the tag is about, when it is about one. */
    readonly subject?: string | null | undefined
    /** The channel of the conversation, when known. */
    readonly channel?: string | null | undefined
    /** The customer the tag is about, when known. */
    readonly leadId?: string | null | undefined
    /** The language the target answers in. */
    readonly locale?: AgentLocale | undefined
    /** Plain data for the target's graph. */
    readonly context?: Readonly<Record<string, unknown>> | undefined
    /** How the hand-off shows. */
    readonly visibility?: AgentTagVisibility | undefined
}

/** A queued hand-off, or null when none waits. */
export type OptionalQueuedTag = QueuedTag | null

/** A queued hand-off as its row holds it: the plain data as JSON text, at most 8000 characters as on a wake. */
export interface StoredTag extends Omit<QueuedTag, "context"> {
    /** The plain data for the target's graph, as JSON text. */
    readonly contextJson?: string | undefined
}
