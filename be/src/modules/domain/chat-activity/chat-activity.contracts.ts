/** What changed for one member: a line arrived, a receipt cursor moved, or the member's unread counts moved. */
export type ChatActivityKind = "message" | "receipt" | "unread"

/**
 * A notification frame of the chat realtime stream. It carries no message body: the client refetches the SWR keys of the named
 * room or conversation (and the room list or unread badges) when it receives one.
 */
export interface ChatActivityFrame {
    /** The domain event id of the frame: `<kind>:<uuid>`, the `Last-Event-ID` resume point. */
    readonly id: string
    /** What changed. */
    readonly kind: ChatActivityKind
    /** The target that changed: `room:<key>` (`room:office` for the general Office), `conversation:<id>`, `agent:<id>` or `lead:<id>`. */
    readonly roomOrConversation: string
    /** ISO 8601 time the change was announced. */
    readonly at: string
}

/** A room or a direct conversation, as the receipt and message writers name it. */
export interface ChatActivityTarget {
    /** A department room key; null is the general Office when conversationId is also null. */
    readonly room: string | null
    /** An agent/customer conversation id, mutually exclusive with a room. */
    readonly conversationId: string | null
}

/** The member who wrote a line; null for a line the system or an agent wrote. */
export type AuthorId = string | null
