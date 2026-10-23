/** What asking the chatbot to message a customer takes, as the caller sent it. */
export interface SendMessageRequest {
    /** The Authorization header as sent. */
    readonly authorization: string | undefined
    /** The text to send. */
    readonly text: string
    /** The customer conversation to message. */
    readonly conversationId?: string | undefined
    /** The customer whose latest conversation to use when no conversation is named. */
    readonly leadId?: string | undefined
    /** True forces a waiting decision whatever the owner's rule says. */
    readonly requireApproval?: boolean | undefined
    /** The caller's Idempotency-Key header. */
    readonly idempotencyKey?: string | undefined
}

/** What asking the chatbot to message a customer answers: the message is queued. */
export interface SendMessageResult {
    /** The conversation the message goes to. */
    readonly conversationId: string
    /** The message is queued; the owner's authority rule decides whether it is sent or waits for a decision. */
    readonly status: "queued"
}
