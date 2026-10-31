import type { ConnectionConversation } from "@modules/domain/agent-conversations"
import type { MessageEventRow } from "./persistence/zalo-page.rows"

/** The most conversations of one connection an events panel looks across. */
export const CONVERSATIONS_MAX = 500

/** The most events an events panel lists. */
export const EVENTS_MAX = 40

/** One stored message as the feed of a connection's conversations lists it. */
export interface FeedLine {
    /** The message id. */
    readonly id: string
    /** The conversation it belongs to. */
    readonly conversationId: string
    /** `user` or `agent`. */
    readonly role: string
    /** The text. */
    readonly body: string
    /** When it was stored, ISO 8601. */
    readonly createdAt: string
    /** `sent`, `failed` or null. */
    readonly deliveryStatus: string | null
    /** The delivery verdict text. */
    readonly deliveryError: string | null
}

/** The event rows of a feed: each message with the name its conversation carries. */
export const messageRowsOf = (
    feed: ReadonlyArray<FeedLine>,
    conversations: ReadonlyArray<ConnectionConversation>,
): Array<MessageEventRow> => {
    const nameOf = new Map(conversations.map((conversation) => [conversation.id, conversation.visitorName]))
    return feed.map((message) => ({
        id: message.id,
        role: message.role,
        body: message.body,
        created_at: message.createdAt,
        delivery_status: message.deliveryStatus,
        delivery_error: message.deliveryError,
        visitor_name: nameOf.get(message.conversationId) ?? null,
    }))
}
