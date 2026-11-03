/** What the customer is told. */
export interface ReplyInput {
    /** The conversation to answer in. */
    readonly conversationId: string
    /** The message. */
    readonly text: string
}

/** The message that was sent. */
export interface ReplyOutput {
    /** The message the host recorded. */
    readonly message: { readonly kind: string; readonly id: string }
}
