/** What a Meta webhook delivery takes: the exact bytes and the signature header. */
export interface AcceptMetaDeliveryRequest {
    /** The unparsed request bytes the signature covers. */
    readonly rawBody: Buffer | undefined
    /** The X-Hub-Signature-256 header. */
    readonly signature: string | undefined
}

/** A delivery is acknowledged with no body. */
export type AcceptMetaDeliveryResult = void
