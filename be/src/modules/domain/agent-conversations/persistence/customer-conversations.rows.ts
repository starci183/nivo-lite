/** A customer conversation linked to a lead in one workspace. */
export interface CustomerConversationRow {
    /** The conversation id. */
    readonly id: string
    /** The linked lead. */
    readonly lead_id: string | null
    /** The person holding the conversation, when one took over. */
    readonly handled_by: string | null
}
