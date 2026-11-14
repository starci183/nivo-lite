import type { ChatbotSettings } from "./rules/settings"
import type { ChatbotChannel, ChatMark, ConversationState, InboxStatus } from "./rules"

/**
 * One conversation as the inbox lists and stores it: the fields of the `blocks-core.chatbot.chat` record the Chatbot module reads and
 * writes: the chatbot's working state on one engine route. The words are the engine's (ruling R26): the chat copies no line; the inbox
 * reads take the last line of the route from `platform.customer-messages`.
 */
export interface ThreadRow extends ConversationState {
    /** The id of the record. */
    readonly id: string
    /** The version token an update must present. */
    readonly version: string
    /** The name the inbox shows: the visitor's name; empty while unknown. */
    readonly name: string
    /** The channel the customer writes from. */
    readonly channel: ChatbotChannel
    /** The core contact the customer is; null while no contact holds them. */
    readonly contactId: string | null
    /** The engine's route the conversation belongs to; null on a chat no route was written on yet. */
    readonly routeId: string | null
    /** Where the chatbot's window on the route's lines starts, as ISO 8601 (a Telegram `/start` opens a new chat from then); null when unknown. */
    readonly startedAt: string | null
    /** The stored mark: a customer waits for a person (
eeds) or not (`ai`); who holds the thread is the route's (ruling R43). */
    readonly status: ChatMark
    /** Whether the customer wrote last and a person is needed. */
    readonly unanswered: boolean
    /** The chatbot's activity stamp (a line heard or answered, a take-over), as ISO 8601: the order of the inbox; null before any. */
    readonly lastAt: string | null
    /** The link of the customer's picture the channel gave; null or absent when it gave none. */
    readonly avatarUrl?: string | null | undefined
}

/** What the customer pane shows of one conversation (the `blocks-core.chatbot.api.chat.get` record). Missing facts are empty text. */
export interface ThreadView {
    /** The id of the conversation. */
    readonly id: string
    /** The name the inbox shows. */
    readonly name: string
    /** The proper name of the channel. */
    readonly channelName: string
    /** The link of the customer's picture; empty when the channel gave none. */
    readonly avatarUrl: string
    /** The core contact behind the conversation; empty while no contact holds the customer. */
    readonly contactId: string
    /** The engine's route of the conversation: the id the engine's release door takes (`hand`); empty while no route was written on the chat. */
    readonly routeId: string
    /** Where the conversation stands in the inbox. */
    readonly status: InboxStatus
    /** The name of the member who holds the route (the engine's staff hold, ruling R43); empty while the AI answers. */
    readonly handledBy: string
}

/** The rules of the Chatbot as the workspace saved them, with who saved them last. */
export interface SavedSettings extends ChatbotSettings {
    /** The name of the member who saved them last. */
    readonly updatedBy: string
}
