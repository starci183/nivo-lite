/** What POST /api/v1/messages answers about the message. */
export class SendMessageDataResponse {
    /** The route (this person on this account) the message goes to. */
    route_id!: string
    /** The message is queued; it is sent to the person's channel after the request commits (once per request: one delivery-ledger row), or held and told to the founder when it asks for approval. */
    status!: "queued"
}

/** The HTTP response of POST /api/v1/messages: the public API wraps its payload in `data`. */
export class SendMessageResponse {
    /** The queued message. */
    data!: SendMessageDataResponse
}
