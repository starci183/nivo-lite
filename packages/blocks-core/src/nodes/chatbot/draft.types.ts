/** What the draft is written for: the conversation, what the customer asked, and what the public knowledge already answered. */
export interface DraftReplyInput {
    /** The conversation the draft is for. */
    readonly conversationId: string
    /** What the customer asked. */
    readonly question: string
    /** The answer the public knowledge gave, to rewrite in the shop's voice; null when it gave none. */
    readonly grounded: string | null
}

/** What the draft came to. */
export interface DraftReplyOutput {
    /** Whether a draft was stored for a person to approve. */
    readonly drafted: boolean
    /** The stored line, with the status proposed; null when no draft was stored. */
    readonly messageId: string | null
}

/** What approving a draft sends: the stored line and its words. */
export interface SendApprovedInput {
    /** The conversation the reply goes to. */
    readonly conversationId: string
    /** The stored line a person approved. */
    readonly messageId: string
    /** The words the person approved, changed or not. */
    readonly text: string
}

/** What sending an approved draft answered. */
export interface SendApprovedOutput {
    /** The message the channel took. */
    readonly sentId: string
}
