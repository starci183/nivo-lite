/** A lead's latest conversation preview and its instant. */
export interface LeadGenLastMessage {
    /** The clipped customer conversation text. */
    readonly text: string
    /** The message instant, ISO 8601. */
    readonly at: string
}

/** Conversation evidence used by the workbench figures and prospect previews. */
export interface LeadGenConversationFacts {
    /** Latest customer conversation message by lead identity. */
    readonly last: Map<string, LeadGenLastMessage>
    /** Minutes to first response for conversations inside the response window. */
    readonly replyMinutes: Array<number>
}
