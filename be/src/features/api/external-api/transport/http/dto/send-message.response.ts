/** What POST /api/v1/messages answers about the message. */
export class SendMessageDataResponse {
    /** The conversation the message goes to. */
    conversation_id!: string
    /** The message is queued; the owner's authority rule decides whether it is sent or waits for a decision. */
    status!: "queued"
}

/** The HTTP response of POST /api/v1/messages: the public API wraps its payload in `data`. */
export class SendMessageResponse {
    /** The queued message. */
    data!: SendMessageDataResponse
}
