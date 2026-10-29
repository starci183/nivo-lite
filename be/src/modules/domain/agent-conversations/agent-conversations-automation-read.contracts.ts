/** The columns of a conversation an automation executor reads. */
export interface AutomationConversationRead {
    /** The conversation id. */
    readonly id: string
    /** The channel. */
    readonly channel: string
    /** The person who took it over. */
    readonly handled_by: string | null
    /** The name the visitor gave. */
    readonly visitor_name: string | null
    /** The lead. */
    readonly lead_id: string | null
}

/** A lead that has a real conversation. */
export interface AutomationChatLead {
    /** The lead id. */
    readonly lead_id: string
}
