import type { ChatbotChannel, ConversationState, InboxStatus, MessageRole } from "../../rules/chatbot"

/**
 * One conversation as the inbox lists and stores it: the fields of the `chat.conversation` record the Chatbot module reads and
 * writes. The marks (`status`, `unanswered`) and the tail (`lastText`, `lastRole`, `lastAt`, `messageCount`) are written with every
 * change by the rules, so the inbox filters, sorts and searches on stored fields only.
 */
export interface ThreadRow extends ConversationState {
    /** The id of the record. */
    readonly id: string
    /** The version token an update must present. */
    readonly version: string
    /** The name the inbox shows: the visitor's name, else the linked customer's; empty while unknown. */
    readonly name: string
    /** The channel the customer writes from. */
    readonly channel: ChatbotChannel
    /** The customer's id on the channel; null for none. */
    readonly externalId: string | null
    /** Where the conversation stands in the inbox. */
    readonly status: InboxStatus
    /** Whether the customer wrote last and a person is needed. */
    readonly unanswered: boolean
    /** When a person took the conversation over, as ISO 8601; null while the AI answers. */
    readonly handledAt: string | null
    /** The customer record behind the conversation; null while the customer was not captured. */
    readonly leadId: string | null
}

/** The fields an update of a conversation may set. */
export type ThreadPatch = Partial<Omit<ThreadRow, "id" | "version">>

/** One stored line of a conversation (the `chat.message` record). */
export interface MessageRecord {
    /** The id of the record. */
    readonly id: string
    /** The version token an update must present. */
    readonly version: string
    /** The conversation the line belongs to. */
    readonly conversationId: string
    /** The role of the line. */
    readonly role: MessageRole
    /** The words of the line. */
    readonly text: string
    /** When the line was written, as ISO 8601. */
    readonly sentAt: string
    /** `human` when a person wrote an agent line, `ai` when the AI did; null for the other roles. */
    readonly authorKind: "ai" | "human" | null
    /** The name of the person who wrote an agent line. */
    readonly authorName: string | null
    /** The member who wrote an agent line. */
    readonly authorUserId: string | null
    /** The state of the push to the channel; null when none was made. */
    readonly deliveryStatus: "sent" | "failed" | null
    /** Why the push failed, as a stable code; null when it did not. */
    readonly deliveryError: string | null
}

/** A line to store. */
export type NewMessage = Pick<
    MessageRecord,
    "conversationId" | "role" | "text" | "sentAt" | "authorKind" | "authorName" | "authorUserId"
>

/** The fields an update of a line may set: the outcome of its push. */
export interface MessagePatch {
    /** The state of the push to the channel. */
    readonly deliveryStatus: "sent" | "failed"
    /** Why the push failed; null on success. */
    readonly deliveryError: string | null
}

/** What an update of a record answers: the record as it is now, or why nothing changed. */
export type UpdateOutcome<T> =
    { readonly ok: true; readonly row: T } | { readonly ok: false; readonly reason: "conflict" | "missing" }

/** The customer facts beside a conversation (the `sales.lead` record). */
export interface LeadFacts {
    /** The name of the contact. */
    readonly contactName: string
    /** The company; null when unknown. */
    readonly company: string | null
    /** The stage of the customer: new, qualified, proposal, won or lost. */
    readonly stage: string
    /** What the customer needs; null when unknown. */
    readonly need: string | null
    /** The phone; null when unknown. */
    readonly phone: string | null
    /** The email; null when unknown. */
    readonly email: string | null
}

/** What the customer pane shows of one conversation (the `chatbot.thread` record). Missing facts are empty text. */
export interface ThreadView {
    /** The id of the conversation. */
    readonly id: string
    /** The name the inbox shows. */
    readonly name: string
    /** The proper name of the channel. */
    readonly channelName: string
    /** Where the conversation stands in the inbox. */
    readonly status: InboxStatus
    /** The person who holds the conversation; empty while the AI answers. */
    readonly handledBy: string
    /** The stage of the customer; empty while the customer was not captured. */
    readonly stage: string
    /** What the customer needs. */
    readonly need: string
    /** The company of the customer. */
    readonly company: string
    /** The phone of the customer. */
    readonly phone: string
    /** The email of the customer. */
    readonly email: string
}

/** What the door asks the channel to send. */
export interface ChatSendInput {
    /** The conversation the text goes to. */
    readonly conversationId: string
    /** The text. */
    readonly text: string
    /** The key that makes a retry of the same send one send: the id of the stored line. */
    readonly key: string
}

/** What the channel answered: sent, or refused with a stable code and whether trying again may work. */
export type ChatSendResult =
    { readonly ok: true } | { readonly ok: false; readonly failure: string; readonly transient: boolean }
