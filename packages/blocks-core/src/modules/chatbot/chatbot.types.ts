import type { ChatbotSettings } from "../../rules/chatbot/settings"
import type {
    ChatbotChannel,
    ConversationState,
    InboxStatus,
    LineFile,
    LineOrder,
    MessageRole,
} from "../../rules/chatbot"

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
    /** The link of the customer's picture the channel gave; null or absent when it gave none. */
    readonly avatarUrl?: string | null | undefined
}

/** Where a line stands: posted in the thread, proposed by the AI and waiting for a person, or refused. */
export type MessageStatus = "posted" | "proposed" | "rejected"

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
    /** Whether the line is posted in the thread, a reply the AI proposed for a person to approve, or a proposal that was refused. */
    readonly status: MessageStatus
    /** The state of the push to the channel; null when none was made. */
    readonly deliveryStatus: "sent" | "failed" | null
    /** Why the push failed, as a stable code; null when it did not. */
    readonly deliveryError: string | null
    /** The agent that sent an agent line (the agent of the turn that wrote it); null for the other lines and for lines from before it was kept. */
    readonly sentBy: string | null
    /** The pictures and files the line carries; absent when it carries none. */
    readonly files?: ReadonlyArray<LineFile> | undefined
    /** The order the line is about (the order card of the thread); absent when it is about none. */
    readonly order?: LineOrder | undefined
}

/** A line to store. */
export type NewMessage = Pick<
    MessageRecord,
    "conversationId" | "role" | "text" | "sentAt" | "authorKind" | "authorName" | "authorUserId"
>

/** The customer facts beside a conversation (the `sales.lead` record the conversation links to). */
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
    /** The link of the customer's picture; empty when the channel gave none. */
    readonly avatarUrl: string
    /** The customer record behind the conversation; empty while the customer was not captured. */
    readonly leadId: string
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

/** The reply the AI proposed for a conversation, as the thread draws it. */
export interface ProposalView {
    /** The id of the proposed line. */
    readonly id: string
    /** What the customer asked, which the reply answers. */
    readonly asked: string
    /** The reply the AI proposes. */
    readonly text: string
    /** A note under the reply. */
    readonly note: string
}

/** The rules of the Chatbot as the workspace saved them, with who saved them last. */
export interface SavedSettings extends ChatbotSettings {
    /** The name of the member who saved them last. */
    readonly updatedBy: string
}
