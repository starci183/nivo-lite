/** A customer conversation message with the timestamp workbenches compare. */
export interface ConversationMessageRow {
    /** The conversation it belongs to. */
    readonly conversation_id: string
    /** Who wrote it. */
    readonly role: string
    /** What was written. */
    readonly body: string
    /** When it was written. */
    readonly created_at: string
}
