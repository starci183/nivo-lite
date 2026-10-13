import type { LeadReadRow, ConversationReadRow } from "./persistence/automations.rows"
import type { MessageVariables } from "./automations.contracts"

/** What a lookup of a lead answers when the id matches no lead of the workspace. */
export type LeadOrNone = LeadReadRow | null

/** What a lookup of a conversation answers when it finds none. */
export type ConversationOrNone = ConversationReadRow | null

/** The name of a staff member, absent when the workspace has none. */
export type NameOrNone = string | null

/** What a customer message is made from. */
export interface Composition {
    /** The authority action the message goes through. */
    readonly action: string
    /** The customer. */
    readonly lead: LeadReadRow
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
