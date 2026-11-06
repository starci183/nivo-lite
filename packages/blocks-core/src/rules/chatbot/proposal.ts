/** The part of a proposed line the thread shows. */
export interface ProposedLine {
    /** The id of the line. */
    readonly id: string
    /** The reply the AI proposes. */
    readonly text: string
}

/** The part of a conversation a proposal answers. */
export interface AskedConversation {
    /** What was said last. */
    readonly lastText: string | null
    /** Who said it last; the customer's words are the question. */
    readonly lastRole: string | null
}

/** What the customer asked: the last words when the customer said them, else nothing. */
export const askedOf = (conversation: AskedConversation): string =>
    conversation.lastRole === "user" ? (conversation.lastText ?? "") : ""
