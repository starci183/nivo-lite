import type { LeadRead, ConversationRead } from "./automation-reads.contracts"
import type { GateFields } from "./automation-ports.contracts"
import type { MessageVariables } from "./automations.contracts"

/** What a lookup of a lead answers when the id matches no lead of the workspace. */
export type LeadOrNone = LeadRead | null

/** What a lookup of a conversation answers when it finds none. */
export type ConversationOrNone = ConversationRead | null

/** The name of a staff member, absent when the workspace has none. */
export type NameOrNone = string | null

/** What a customer message is made from. */
export interface Composition {
    /** The authority action the message goes through. */
    readonly action: string
    /** The customer. */
    readonly lead: LeadRead
    /** The conversation it leaves on. */
    readonly conversationId: string
    /** Unique per occurrence: the same key never sends twice. */
    readonly dedupe: string
    /** What the message does, in a line. */
    readonly summary: string
    /** What the model is told about this case. */
    readonly caseNote: string
    /** The variables of the approved wording. */
    readonly vars: MessageVariables
    /** True when the owner must decide whatever the rule says. */
    readonly forceAsk: boolean
    /**
     * Text added after the written message word for word (payment details, a QR link): never filled and never shown to the model,
     * so it reaches the owner and the customer exactly as built.
     */
    readonly fixedTail?: string | undefined
    /** Values a model rewrite must keep word for word; a rewrite that drops one is discarded for the filled wording. */
    readonly keepExact?: ReadonlyArray<string> | undefined
    /** Facts that ride with the message through the gate to its performer (a renewal's notice for the ZNS route). */
    readonly fields?: GateFields | undefined
}

/** A reply to a conversation that has no lead yet. */
export interface BareReply {
    /** The conversation it leaves on. */
    readonly conversationId: string
    /** The name the visitor gave. */
    readonly name: string
    /** Unique per occurrence. */
    readonly dedupe: string
}

/** A customer message as written, and who wrote it. */
export interface WrittenMessage {
    /** The text, before any fixed tail. */
    readonly text: string
    /** True when the model adapted the approved wording. */
    readonly generated: boolean
    /** True when the model was asked but did not answer, so the filled wording stands in; the owner sees it marked. */
    readonly fallback: boolean
}
