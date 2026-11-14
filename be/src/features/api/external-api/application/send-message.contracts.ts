/** What asking the chatbot to message a customer takes, as the caller sent it. */
export interface SendMessageRequest {
    /** The Authorization header as sent. */
    readonly authorization: string | undefined
    /** The text to send. */
    readonly text: string
    /** The customer conversation to message: the ROUTE id. */
    readonly conversationId: string
    /** True forces a waiting decision whatever the owner's rule says. */
    readonly requireApproval?: boolean | undefined
    /** The caller's Idempotency-Key header. */
    readonly idempotencyKey?: string | undefined
}

/** What asking the chatbot to message a customer answers: the message is queued. */
export interface SendMessageResult {
    /** The conversation the message goes to. */
    readonly conversationId: string
    /** The message is stored and queued; it is delivered after the request commits, or held and told to the founder when it asks for approval. */
    readonly status: "queued"
}
